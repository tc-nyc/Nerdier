package com.nerdier.game.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row as LayoutRow
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nerdier.game.R
import com.nerdier.game.data.StatsSummary
import com.nerdier.game.model.MAX_GUESSES
import com.nerdier.game.ui.components.GuessDistributionChart
import com.nerdier.game.ui.theme.NerdierTheme
import kotlin.math.roundToInt

/**
 * What one Progress section needs to render.
 *
 * A UI-layer view model, deliberately minimal: the composables below render
 * from this and nothing else, so the screen and its previews stand up without
 * `data/StatsModels.kt`. [toPeriodStatsUi] adapts the coder's `StatsSummary`
 * onto it — a five-field copy, nothing clever.
 */
data class PeriodStatsUi(
    val played: Int = 0,
    val won: Int = 0,
    val currentStreak: Int = 0,
    /** Six counts: wins in 1, 2, 3, 4, 5, 6 guesses. */
    val distribution: List<Int> = List(MAX_GUESSES) { 0 },
    /**
     * Defaults to a half-up rounding of won/played, but is a constructor
     * parameter so a caller that already computed it (StatsSummary does) can
     * pass its own value through and keep the two in exact agreement.
     */
    val winPercent: Int = if (played == 0) 0 else (won * 100.0 / played).roundToInt(),
)

/** Adapter for the coder's rollup type. The nav host needs nothing more. */
fun StatsSummary.toPeriodStatsUi(): PeriodStatsUi = PeriodStatsUi(
    played = played,
    won = won,
    currentStreak = currentStreak,
    distribution = guessDistribution,
    winPercent = winPercent,
)

/**
 * Today / This Week / This Month, each with the four headline numbers and a
 * wins-by-guess-count histogram drawn from Compose primitives.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgressScreen(
    today: PeriodStatsUi,
    thisWeek: PeriodStatsUi,
    thisMonth: PeriodStatsUi,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.progress_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                        )
                    }
                },
            )
        },
    ) { insets ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(insets)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            PeriodSection(stringResource(R.string.progress_today), today)
            PeriodSection(stringResource(R.string.progress_this_week), thisWeek)
            PeriodSection(stringResource(R.string.progress_this_month), thisMonth)
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun PeriodSection(title: String, stats: PeriodStatsUi) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(12.dp))

            LayoutRow(modifier = Modifier.fillMaxWidth()) {
                StatCell(stringResource(R.string.stat_played), stats.played.toString())
                StatCell(stringResource(R.string.stat_won), stats.won.toString())
                StatCell(stringResource(R.string.stat_win_rate), "${stats.winPercent}%")
                StatCell(stringResource(R.string.stat_streak), stats.currentStreak.toString())
            }

            Spacer(Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(Modifier.height(12.dp))

            Text(
                text = stringResource(R.string.progress_distribution),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(10.dp))

            if (stats.played == 0) {
                Text(
                    text = stringResource(R.string.progress_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                GuessDistributionChart(distribution = stats.distribution)
            }
        }
    }
}

/**
 * One headline number. The value and its label are merged into a single
 * spoken phrase, otherwise TalkBack reads a wall of bare digits.
 */
@Composable
private fun RowScope.StatCell(
    label: String,
    value: String,
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .semantics(mergeDescendants = true) {
                contentDescription = "$label: $value"
            },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.clearAndSetSemantics { },
        )
    }
}

/* ------------------------------------------------------------------------ */
/* Previews                                                                  */
/* ------------------------------------------------------------------------ */

private fun sampleStats() = Triple(
    PeriodStatsUi(played = 3, won = 2, currentStreak = 2, distribution = listOf(0, 0, 1, 1, 0, 0)),
    PeriodStatsUi(played = 14, won = 11, currentStreak = 5, distribution = listOf(0, 1, 3, 4, 2, 1)),
    PeriodStatsUi(played = 41, won = 33, currentStreak = 5, distribution = listOf(1, 3, 8, 12, 6, 3)),
)

@Preview(name = "Progress - light", widthDp = 360, heightDp = 1100, showBackground = true)
@Composable
private fun ProgressLightPreview() {
    val (d, w, m) = sampleStats()
    NerdierTheme(darkTheme = false) {
        Box(Modifier.fillMaxSize()) {
            ProgressScreen(today = d, thisWeek = w, thisMonth = m, onBack = {})
        }
    }
}

@Preview(name = "Progress - dark", widthDp = 360, heightDp = 1100, showBackground = true)
@Composable
private fun ProgressDarkPreview() {
    val (d, w, m) = sampleStats()
    NerdierTheme(darkTheme = true) {
        Box(Modifier.fillMaxSize()) {
            ProgressScreen(today = d, thisWeek = w, thisMonth = m, onBack = {})
        }
    }
}

@Preview(name = "Progress - empty", widthDp = 360, heightDp = 700, showBackground = true)
@Composable
private fun ProgressEmptyPreview() {
    NerdierTheme(darkTheme = false) {
        Box(Modifier.fillMaxSize()) {
            ProgressScreen(
                today = PeriodStatsUi(),
                thisWeek = PeriodStatsUi(),
                thisMonth = PeriodStatsUi(),
                onBack = {},
            )
        }
    }
}
