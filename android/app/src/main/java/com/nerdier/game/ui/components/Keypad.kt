package com.nerdier.game.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nerdier.game.model.TileState
import com.nerdier.game.ui.theme.LocalNerdierColors

/** Minimum tappable edge, per the accessibility bar we hold ourselves to. */
private val KeyHeight = 52.dp
private val KeyGap = 6.dp

private val ROW_ONE = listOf('1', '2', '3', '4', '5')
private val ROW_TWO = listOf('6', '7', '8', '9', '0')
private val ROW_THREE = listOf('+', '-', '*', '/', '=')

/**
 * The entry keypad.
 *
 * Deliberately five keys per row rather than ten: on a 360dp phone ten keys
 * would be ~33dp wide, under the 48dp tap-target floor. Five keys give roughly
 * 62dp each with page padding, and the whole pad is four rows / ~248dp tall,
 * which leaves the board its space.
 *
 * Keys inherit the same green / purple / black semantics as the board, so a
 * character the player has already eliminated reads as eliminated everywhere.
 * The state is also in each key's `contentDescription` — colour is never the
 * only channel.
 */
@Composable
fun Keypad(
    keyStates: Map<Char, TileState>,
    onKeyPress: (Char) -> Unit,
    onDelete: () -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
    canSubmit: Boolean = true,
    canDelete: Boolean = true,
    enabled: Boolean = true,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(KeyGap),
    ) {
        listOf(ROW_ONE, ROW_TWO, ROW_THREE).forEach { keys ->
            Row(horizontalArrangement = Arrangement.spacedBy(KeyGap)) {
                keys.forEach { c ->
                    CharKey(
                        char = c,
                        state = keyStates[c] ?: TileState.EMPTY,
                        enabled = enabled,
                        onClick = { onKeyPress(c) },
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(KeyGap)) {
            KeyButton(
                label = "DELETE",
                description = "Delete last character",
                fill = MaterialTheme.colorScheme.surfaceVariant,
                contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                border = MaterialTheme.colorScheme.outline,
                enabled = enabled && canDelete,
                onClick = onDelete,
            )
            KeyButton(
                label = "ENTER",
                description = if (canSubmit) {
                    "Enter, submit this guess"
                } else {
                    "Enter, unavailable until all eight tiles are filled"
                },
                fill = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                border = MaterialTheme.colorScheme.primary,
                enabled = enabled && canSubmit,
                onClick = onSubmit,
            )
        }
    }
}

@Composable
private fun RowScope.CharKey(
    char: Char,
    state: TileState,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val colors = LocalNerdierColors.current
    val fill = when (state) {
        TileState.CORRECT -> colors.correct
        TileState.PRESENT -> colors.present
        TileState.ABSENT -> colors.absent
        TileState.EMPTY, TileState.FILLED -> colors.keyIdle
    }
    val contentColor = when (state) {
        TileState.CORRECT -> colors.onCorrect
        TileState.PRESENT -> colors.onPresent
        TileState.ABSENT -> colors.onAbsent
        TileState.EMPTY, TileState.FILLED -> colors.onKeyIdle
    }
    // Same trick as the board: a bright border keeps an eliminated (black) key
    // visible against a near-black surface in dark mode.
    val border = when (state) {
        TileState.CORRECT -> colors.correctBorder
        TileState.PRESENT -> colors.presentBorder
        TileState.ABSENT -> colors.absentBorder
        TileState.EMPTY, TileState.FILLED -> colors.keyIdle
    }

    val stateWord = when (state) {
        TileState.CORRECT -> "known correct position"
        TileState.PRESENT -> "in the equation, position unknown"
        TileState.ABSENT -> "eliminated"
        TileState.EMPTY, TileState.FILLED -> "not yet tried"
    }

    KeyButton(
        label = char.toString(),
        description = "${spokenChar(char)}, $stateWord",
        fill = fill,
        contentColor = contentColor,
        border = border,
        enabled = enabled,
        labelSizeSp = 20f,
        onClick = onClick,
    )
}

@Composable
private fun RowScope.KeyButton(
    label: String,
    description: String,
    fill: Color,
    contentColor: Color,
    border: Color,
    enabled: Boolean,
    onClick: () -> Unit,
    labelSizeSp: Float = 13f,
) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier = Modifier
            .weight(1f)
            .height(KeyHeight)
            .clip(shape)
            .background(fill)
            .border(1.5.dp, border, shape)
            .alpha(if (enabled) 1f else 0.45f)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = contentColor,
            fontSize = labelSizeSp.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .padding(horizontal = 2.dp)
                .clearAndSetSemantics { },
        )
    }
}
