package com.nerdier.game.data

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters

/**
 * One finished game.
 *
 * @param timestampMillis when the game ended, epoch millis (UTC instant).
 * @param won true if the player solved it.
 * @param guessesUsed rows consumed, 1..6. Invalid submissions never counted, so a
 *   loss is always 6.
 */
data class GameRecord(
    val timestampMillis: Long,
    val won: Boolean,
    val guessesUsed: Int,
)

/** Which window a rollup covers. */
enum class StatsPeriod { TODAY, THIS_WEEK, THIS_MONTH }

/**
 * A rollup over one [StatsPeriod].
 *
 * @param guessDistribution always 6 entries; index 0 is "solved in 1 guess",
 *   index 5 is "solved in 6". Losses are not represented here.
 */
data class StatsSummary(
    val period: StatsPeriod,
    val played: Int = 0,
    val won: Int = 0,
    val winPercent: Int = 0,
    val currentStreak: Int = 0,
    val guessDistribution: List<Int> = List(6) { 0 },
) {
    val lost: Int get() = played - won

    /** Largest bar in the distribution, for scaling the chart. At least 1 to avoid /0. */
    val maxDistributionCount: Int get() = guessDistribution.maxOrNull()?.coerceAtLeast(1) ?: 1
}

/** All three rollups, so the Progress screen can render from a single emission. */
data class StatsSummaries(
    val today: StatsSummary = StatsSummary(StatsPeriod.TODAY),
    val thisWeek: StatsSummary = StatsSummary(StatsPeriod.THIS_WEEK),
    val thisMonth: StatsSummary = StatsSummary(StatsPeriod.THIS_MONTH),
)

/**
 * Bucketing and aggregation. Pure functions — no Android, no I/O, no clock of
 * their own — so every boundary case is unit testable by passing `nowMillis`.
 *
 * Boundaries use `java.time` in the caller's zone (default [ZoneId.systemDefault]),
 * and the week starts **Monday** (ISO-8601).
 *
 * NOTE for the senior developer: `java.time` needs core library desugaring at
 * minSdk 24. See the dependency note in the handover.
 */
object StatsCalculator {

    /** Local calendar day a record belongs to. */
    fun localDate(timestampMillis: Long, zone: ZoneId): LocalDate =
        Instant.ofEpochMilli(timestampMillis).atZone(zone).toLocalDate()

    /** Monday of the week containing [day]. Returns [day] itself when it is a Monday. */
    fun weekStart(day: LocalDate): LocalDate =
        day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))

    /**
     * True when [day] falls inside [period] as measured from [today].
     *
     * Week is the half-open range `[Monday, Monday + 7 days)` — so the Monday that
     * starts the week is in, and the Monday that starts the next week is out.
     * Month is same calendar year *and* month, so a December/January rollover does
     * not silently merge.
     */
    fun isInPeriod(day: LocalDate, today: LocalDate, period: StatsPeriod): Boolean =
        when (period) {
            StatsPeriod.TODAY -> day == today
            StatsPeriod.THIS_WEEK -> {
                val start = weekStart(today)
                !day.isBefore(start) && day.isBefore(start.plusDays(7))
            }
            StatsPeriod.THIS_MONTH ->
                day.year == today.year && day.month == today.month
        }

    /**
     * Rolls [records] up over [period].
     *
     * `currentStreak` is the run of wins at the *end* of the period's games, in
     * chronological order — i.e. how many games in a row the player has won as of
     * their most recent game inside this window. A loss resets it to 0. It is
     * game-based, not calendar-day-based: skipping a day does not break it, and
     * two games on one day both count.
     */
    fun summarize(
        records: List<GameRecord>,
        period: StatsPeriod,
        nowMillis: Long,
        zone: ZoneId = ZoneId.systemDefault(),
    ): StatsSummary {
        val today = localDate(nowMillis, zone)
        val selected = records
            .filter { isInPeriod(localDate(it.timestampMillis, zone), today, period) }
            .sortedBy { it.timestampMillis }

        if (selected.isEmpty()) return StatsSummary(period)

        val played = selected.size
        val won = selected.count { it.won }

        val distribution = MutableList(6) { 0 }
        for (r in selected) {
            if (r.won && r.guessesUsed in 1..6) {
                distribution[r.guessesUsed - 1] = distribution[r.guessesUsed - 1] + 1
            }
        }

        var streak = 0
        for (r in selected.asReversed()) {
            if (!r.won) break
            streak++
        }

        return StatsSummary(
            period = period,
            played = played,
            won = won,
            // Rounded half-up, matching what players expect from a percentage.
            winPercent = Math.round(won * 100.0 / played).toInt(),
            currentStreak = streak,
            guessDistribution = distribution,
        )
    }

    fun summarizeAll(
        records: List<GameRecord>,
        nowMillis: Long,
        zone: ZoneId = ZoneId.systemDefault(),
    ): StatsSummaries = StatsSummaries(
        today = summarize(records, StatsPeriod.TODAY, nowMillis, zone),
        thisWeek = summarize(records, StatsPeriod.THIS_WEEK, nowMillis, zone),
        thisMonth = summarize(records, StatsPeriod.THIS_MONTH, nowMillis, zone),
    )
}
