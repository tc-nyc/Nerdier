package com.nerdier.game.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nerdier.game.model.MAX_GUESSES
import com.nerdier.game.ui.theme.LocalNerdierColors

/**
 * Wins-by-guess-count histogram, drawn with plain Compose layout — no charting
 * library. Bars are `fillMaxHeight(fraction)` inside a fixed-height track, and
 * every bar carries a spoken description so the shape of the distribution is
 * available without sight.
 *
 * @param distribution six counts: wins in 1, 2, 3, 4, 5 and 6 guesses.
 */
@Composable
fun GuessDistributionChart(
    distribution: List<Int>,
    modifier: Modifier = Modifier,
    barHeight: Dp = 108.dp,
) {
    val colors = LocalNerdierColors.current
    val counts = List(MAX_GUESSES) { distribution.getOrElse(it) { 0 } }
    val peak = counts.maxOrNull() ?: 0
    val total = counts.sum()

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(barHeight),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            counts.forEachIndexed { index, count ->
                val fraction = if (peak == 0) 0f else count.toFloat() / peak.toFloat()
                // Keep a visible stub for zero so the axis still reads as six
                // columns rather than a gap.
                val drawn = if (count == 0) 0.04f else fraction.coerceAtLeast(0.10f)

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .semantics {
                            contentDescription =
                                "$count ${if (count == 1) "win" else "wins"} in " +
                                    "${index + 1} ${if (index == 0) "guess" else "guesses"}"
                        },
                    verticalArrangement = Arrangement.Bottom,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = count.toString(),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.clearAndSetSemantics { },
                    )
                    Box(
                        modifier = Modifier
                            .padding(top = 4.dp)
                            .fillMaxWidth()
                            .height(((barHeight.value - 22f) * drawn).dp)
                            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                            .background(if (count == 0) colors.chartBarMuted else colors.chartBar),
                    )
                }
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 6.dp)
                .clearAndSetSemantics { },
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            counts.indices.forEach { index ->
                Text(
                    text = (index + 1).toString(),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Text(
            text = if (total == 0) {
                "No wins recorded yet."
            } else {
                "Guesses used, across $total ${if (total == 1) "win" else "wins"}."
            },
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}
