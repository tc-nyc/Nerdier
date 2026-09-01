package com.nerdier.game.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row as LayoutRow
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nerdier.game.model.EQUATION_LENGTH
import com.nerdier.game.model.MAX_GUESSES
import com.nerdier.game.model.Row
import com.nerdier.game.model.Tile
import com.nerdier.game.model.TileState
import com.nerdier.game.ui.theme.LocalNerdierColors
import com.nerdier.game.ui.theme.TileGlyphStyle

private val TileGap = 4.dp
private val RowGap = 4.dp
private val MinTile = 22.dp
private val MaxTile = 56.dp

/** Spoken form of a board character, so TalkBack never has to read "asterisk". */
internal fun spokenChar(c: Char): String = when (c) {
    '+' -> "plus"
    '-' -> "minus"
    '*' -> "times"
    '/' -> "divided by"
    '=' -> "equals"
    else -> c.toString()
}

internal fun spokenState(state: TileState): String = when (state) {
    TileState.EMPTY -> "empty"
    TileState.FILLED -> "entered, not yet submitted"
    TileState.CORRECT -> "correct, right position"
    TileState.PRESENT -> "present, wrong position"
    TileState.ABSENT -> "not in the equation"
}

/**
 * The 6 x 8 guess board.
 *
 * ## How this fits a 360dp phone
 * The grid never assumes a tile size. [BoxWithConstraints] hands us the space
 * actually available and the tile edge is the smaller of the width-derived and
 * the height-derived fit:
 *
 *   widthFit  = (maxWidth  - 7 * gap) / 8
 *   heightFit = (maxHeight - 5 * gap) / 6
 *
 * On a 360dp screen with 16dp of page padding that is (328 - 28) / 8 = 37.5dp,
 * so the board is 8 * 37.5 + 28 = 328dp wide — it fits with room to spare and
 * can never scroll horizontally. Because the height term is also honoured, the
 * board shrinks rather than shoving the keypad off the bottom on short screens.
 * The result is clamped to [MinTile]..[MaxTile] so it stays tappable on tiny
 * screens and doesn't turn into dinner plates on a tablet.
 *
 * @param shakeRowIndex which row to shake, or -1 for none.
 * @param shakeTrigger increment this to fire a shake; the value itself is
 *   ignored, only the change matters. A shake means "this row was rejected and
 *   was NOT consumed".
 */
@Composable
fun TileGrid(
    rows: List<Row>,
    modifier: Modifier = Modifier,
    shakeRowIndex: Int = -1,
    shakeTrigger: Int = 0,
) {
    val shakeOffset = remember { Animatable(0f) }

    LaunchedEffect(shakeTrigger) {
        if (shakeTrigger > 0) {
            shakeOffset.snapTo(0f)
            shakeOffset.animateTo(
                targetValue = 0f,
                animationSpec = keyframes<Float> {
                    durationMillis = 380
                    0f at 0
                    -14f at 50
                    14f at 100
                    -10f at 150
                    10f at 210
                    -5f at 270
                    0f at 380
                },
            )
        }
    }

    BoxWithConstraints(modifier = modifier, contentAlignment = Alignment.Center) {
        val widthFit: Dp = (maxWidth - TileGap * (EQUATION_LENGTH - 1)) / EQUATION_LENGTH
        val heightFit: Dp = if (constraints.hasBoundedHeight) {
            (maxHeight - RowGap * (MAX_GUESSES - 1)) / MAX_GUESSES
        } else {
            widthFit
        }
        val tileSize: Dp = minOf(widthFit, heightFit).coerceIn(MinTile, MaxTile)

        Column(
            verticalArrangement = Arrangement.spacedBy(RowGap),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            rows.forEachIndexed { rowIndex, row ->
                val isShaking = rowIndex == shakeRowIndex
                LayoutRow(
                    horizontalArrangement = Arrangement.spacedBy(TileGap),
                    modifier = if (isShaking) {
                        Modifier.graphicsLayer { translationX = shakeOffset.value }
                    } else {
                        Modifier
                    },
                ) {
                    row.tiles.forEachIndexed { colIndex, tile ->
                        GuessTile(
                            tile = tile,
                            size = tileSize,
                            rowNumber = rowIndex + 1,
                            columnNumber = colIndex + 1,
                        )
                    }
                }
            }
        }
    }
}

/** One board cell. Fill, border and glyph colour are all driven by [TileState]. */
@Composable
fun GuessTile(
    tile: Tile,
    size: Dp,
    rowNumber: Int,
    columnNumber: Int,
    modifier: Modifier = Modifier,
    descriptionOverride: String? = null,
) {
    val colors = LocalNerdierColors.current

    val targetFill: Color = when (tile.state) {
        TileState.CORRECT -> colors.correct
        TileState.PRESENT -> colors.present
        TileState.ABSENT -> colors.absent
        TileState.EMPTY, TileState.FILLED -> Color.Transparent
    }
    val targetBorder: Color = when (tile.state) {
        TileState.CORRECT -> colors.correctBorder
        TileState.PRESENT -> colors.presentBorder
        // The border is what keeps a black tile from disappearing into a black
        // page in dark mode. It is always drawn, never conditional.
        TileState.ABSENT -> colors.absentBorder
        TileState.EMPTY -> colors.tileEmptyBorder
        TileState.FILLED -> colors.tileFilledBorder
    }
    val targetGlyph: Color = when (tile.state) {
        TileState.CORRECT -> colors.onCorrect
        TileState.PRESENT -> colors.onPresent
        TileState.ABSENT -> colors.onAbsent
        TileState.EMPTY, TileState.FILLED -> MaterialTheme.colorScheme.onBackground
    }

    // Staggered reveal: column N waits 45ms longer than column N-1, so a
    // submitted row lights up left-to-right in under half a second. This is
    // pure colour animation on an already-committed state — it never gates
    // input, and the tile is readable (and announced) the whole time.
    val revealed = tile.state == TileState.CORRECT ||
        tile.state == TileState.PRESENT ||
        tile.state == TileState.ABSENT
    val delay = if (revealed) (columnNumber - 1) * 45 else 0
    val spec = tween<Color>(durationMillis = 180, delayMillis = delay)

    val fill by animateColorAsState(targetFill, spec, label = "tileFill")
    val border by animateColorAsState(targetBorder, spec, label = "tileBorder")
    val glyph by animateColorAsState(targetGlyph, spec, label = "tileGlyph")

    val description = descriptionOverride ?: buildString {
        append("Row ")
        append(rowNumber)
        append(", position ")
        append(columnNumber)
        append(", ")
        val c = tile.char
        if (c != null) {
            append(spokenChar(c))
            append(", ")
        }
        append(spokenState(tile.state))
    }

    // Glyph tracks tile size so it never clips on a narrow phone.
    val fontSize = (size.value * 0.46f).sp

    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(6.dp))
            .background(fill)
            .border(2.dp, border, RoundedCornerShape(6.dp))
            .clearAndSetSemantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = tile.char?.toString().orEmpty(),
            style = TileGlyphStyle.copy(fontSize = fontSize, color = glyph),
            textAlign = TextAlign.Center,
            maxLines = 1,
        )
    }
}

/** Convenience: an empty board, useful for previews and for a fresh game. */
fun emptyBoard(): List<Row> = List(MAX_GUESSES) { Row() }
