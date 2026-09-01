package com.nerdier.game.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * A three-bar chart glyph, drawn by hand.
 *
 * `Icons.Filled.BarChart` lives in `material-icons-extended`, a multi-megabyte
 * artefact we would be adding for exactly one icon. Nine lines of Canvas is the
 * cheaper trade. Everything else in the app uses icons from
 * `material-icons-core`, which ships with Material 3.
 */
@Composable
fun BarChartIcon(
    tint: Color,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier.size(24.dp)) {
        val w = size.width
        val h = size.height
        val barWidth = w * 0.18f
        val gap = (w - barWidth * 3f) / 4f
        val radius = CornerRadius(barWidth * 0.25f, barWidth * 0.25f)
        val heights = floatArrayOf(0.42f, 0.72f, 0.94f)

        heights.forEachIndexed { index, fraction ->
            val barHeight = h * 0.88f * fraction
            drawRoundRect(
                color = tint,
                topLeft = Offset(gap + index * (barWidth + gap), h * 0.94f - barHeight),
                size = Size(barWidth, barHeight),
                cornerRadius = radius,
            )
        }
    }
}
