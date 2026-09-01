package com.nerdier.game.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import java.io.IOException
import java.time.ZoneId

/**
 * Persistent history of finished games, surviving process death.
 *
 * Interface-backed on purpose: [InMemoryStatsRepository] lets the ViewModel and
 * the rollups be tested with no Android runtime at all.
 */
interface StatsRepository {

    /** Every recorded game, oldest first. Emits again after each [record]. */
    val records: Flow<List<GameRecord>>

    /** Appends one finished game. Called once, when a game reaches WON or LOST. */
    suspend fun record(record: GameRecord)

    /** Overridable in tests to pin the calendar. */
    val zone: ZoneId get() = ZoneId.systemDefault()

    /** Overridable in tests to pin "now". */
    fun nowMillis(): Long = System.currentTimeMillis()

    suspend fun today(): StatsSummary =
        StatsCalculator.summarize(records.first(), StatsPeriod.TODAY, nowMillis(), zone)

    suspend fun thisWeek(): StatsSummary =
        StatsCalculator.summarize(records.first(), StatsPeriod.THIS_WEEK, nowMillis(), zone)

    suspend fun thisMonth(): StatsSummary =
        StatsCalculator.summarize(records.first(), StatsPeriod.THIS_MONTH, nowMillis(), zone)

    /** All three rollups as a stream, so the Progress screen renders from one collect. */
    fun summaries(): Flow<StatsSummaries> =
        records.map { StatsCalculator.summarizeAll(it, nowMillis(), zone) }
}

// ---------------------------------------------------------------------------
// Persistence choice: DataStore Preferences (NOT Room).
//
// What we store is one append-only list of three-field records that is always
// read in full and never queried relationally — no joins, no indexes, no
// partial updates, no migrations worth the name. Room would mean a compiler
// plugin, a database class, a DAO, an entity and schema files to earn nothing
// over a single string. DataStore also gives us the two properties that
// actually matter here for free: transactional writes that survive process
// death, and a Flow that re-emits so the Progress screen stays live.
//
// The bound below keeps the single value small; at one game per day it is
// decades of history, and the rollups only ever look back one month.
// ---------------------------------------------------------------------------

private const val MAX_RECORDS = 1_000
private const val RECORD_SEPARATOR = "\n"
private const val FIELD_SEPARATOR = "|"

private val RECORDS_KEY = stringPreferencesKey("game_records")

/** The app's single stats DataStore. */
val Context.statsDataStore: DataStore<Preferences> by preferencesDataStore(name = "nerdier_stats")

/** Convenience factory for the composition root. */
fun defaultStatsRepository(context: Context): StatsRepository =
    DataStoreStatsRepository(context.applicationContext.statsDataStore)

class DataStoreStatsRepository(
    private val dataStore: DataStore<Preferences>,
) : StatsRepository {

    override val records: Flow<List<GameRecord>> = dataStore.data
        // A corrupt or unreadable file must not crash the game; stats are not
        // load-bearing for play. Fall back to "no history".
        .catch { e -> if (e is IOException) emit(emptyPreferences()) else throw e }
        .map { prefs -> decode(prefs[RECORDS_KEY]) }

    override suspend fun record(record: GameRecord) {
        // edit {} is transactional and serialised per DataStore, so this
        // read-modify-write cannot interleave with another write.
        dataStore.edit { prefs ->
            val existing = decode(prefs[RECORDS_KEY])
            val updated = (existing + record).takeLast(MAX_RECORDS)
            prefs[RECORDS_KEY] = encode(updated)
        }
    }

    private fun encode(records: List<GameRecord>): String =
        records.joinToString(RECORD_SEPARATOR) { r ->
            listOf(
                r.timestampMillis.toString(),
                if (r.won) "1" else "0",
                r.guessesUsed.toString(),
            ).joinToString(FIELD_SEPARATOR)
        }

    /** Tolerant by design: a malformed line is dropped, not fatal. */
    private fun decode(raw: String?): List<GameRecord> {
        if (raw.isNullOrEmpty()) return emptyList()
        return raw.split(RECORD_SEPARATOR).mapNotNull { line ->
            if (line.isBlank()) return@mapNotNull null
            val parts = line.split(FIELD_SEPARATOR)
            if (parts.size != 3) return@mapNotNull null
            val timestamp = parts[0].toLongOrNull() ?: return@mapNotNull null
            val guesses = parts[2].toIntOrNull() ?: return@mapNotNull null
            GameRecord(
                timestampMillis = timestamp,
                won = parts[1] == "1",
                guessesUsed = guesses,
            )
        }.sortedBy { it.timestampMillis }
    }
}

/**
 * Non-persistent fake for unit tests and Compose previews.
 *
 * @param initial seed history, oldest first.
 * @param fixedNowMillis pin "now" so period boundaries are deterministic; null uses the wall clock.
 * @param fixedZone pin the calendar zone.
 */
class InMemoryStatsRepository(
    initial: List<GameRecord> = emptyList(),
    private val fixedNowMillis: Long? = null,
    private val fixedZone: ZoneId? = null,
) : StatsRepository {

    private val state = MutableStateFlow(initial.sortedBy { it.timestampMillis })

    override val records: Flow<List<GameRecord>> = state.asStateFlow()

    override val zone: ZoneId get() = fixedZone ?: ZoneId.systemDefault()

    override fun nowMillis(): Long = fixedNowMillis ?: System.currentTimeMillis()

    override suspend fun record(record: GameRecord) {
        state.update { (it + record).sortedBy { r -> r.timestampMillis } }
    }
}
