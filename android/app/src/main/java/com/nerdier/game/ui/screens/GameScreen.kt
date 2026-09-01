package com.nerdier.game.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row as LayoutRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nerdier.game.R
import com.nerdier.game.model.EQUATION_LENGTH
import com.nerdier.game.model.GameStatus
import com.nerdier.game.model.MAX_GUESSES
import com.nerdier.game.model.Row
import com.nerdier.game.model.Tile
import com.nerdier.game.model.TileState
import com.nerdier.game.ui.components.BarChartIcon
import com.nerdier.game.ui.components.ErrorBanner
import com.nerdier.game.ui.components.Keypad
import com.nerdier.game.ui.components.TileGrid
import com.nerdier.game.ui.theme.NerdierTheme
import kotlinx.coroutines.launch

/**
 * The board screen.
 *
 * Entirely stateless with respect to the game: it receives the pieces of
 * `GameUiState` it needs as plain parameters and emits intents upward. The only
 * state it owns is presentational: whether the drawer is open.
 *
 * @param rows the six board rows; the player edits row [currentRow].
 * @param keyStates best-known state per keypad character.
 * @param error transient validator message, or null.
 * @param target revealed only once the game is lost.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameScreen(
    rows: List<Row>,
    keyStates: Map<Char, TileState>,
    error: String?,
    status: GameStatus,
    guessesUsed: Int,
    target: String?,
    onKeyPress: (Char) -> Unit,
    onDelete: () -> Unit,
    onSubmit: () -> Unit,
    onNewGame: () -> Unit,
    onOpenRules: () -> Unit,
    onOpenProgress: () -> Unit,
    modifier: Modifier = Modifier,
    /** Index of the row the player is editing. Defaults to [guessesUsed]. */
    currentRow: Int = guessesUsed,
    /**
     * Nonce that changes on every new validator error (`GameUiState.errorId`).
     * A change makes the active row shake. Passing the message alone would not
     * do — two identical rejections in a row must still shake twice.
     */
    errorId: Int = 0,
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    val inProgress = status == GameStatus.IN_PROGRESS
    val activeRowIndex = currentRow.coerceIn(0, MAX_GUESSES - 1)
    val activeRowLength = rows.getOrNull(activeRowIndex)?.text?.length ?: 0
    val canSubmit = inProgress && activeRowLength == EQUATION_LENGTH
    val canDelete = inProgress && activeRowLength > 0

    val boardDescription = stringResource(R.string.board_description)
    val progressDescription = stringResource(R.string.action_open_progress)

    ModalNavigationDrawer(
        drawerState = drawerState,
        modifier = modifier,
        drawerContent = {
            ModalDrawerSheet {
                Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 20.dp)) {
                    Text(
                        text = stringResource(R.string.drawer_heading),
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = stringResource(R.string.drawer_subheading),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                HorizontalDivider()
                Spacer(Modifier.height(8.dp))
                NavigationDrawerItem(
                    label = { Text(stringResource(R.string.drawer_new_game)) },
                    icon = { Icon(Icons.Filled.Refresh, contentDescription = null) },
                    selected = false,
                    onClick = {
                        scope.launch { drawerState.close() }
                        onNewGame()
                    },
                    modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
                )
                NavigationDrawerItem(
                    label = { Text(stringResource(R.string.drawer_rules)) },
                    icon = { Icon(Icons.Filled.Info, contentDescription = null) },
                    selected = false,
                    onClick = {
                        scope.launch { drawerState.close() }
                        onOpenRules()
                    },
                    modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
                )
            }
        },
    ) {
        Scaffold(
            topBar = {
                CenterAlignedTopAppBar(
                    title = { Text(stringResource(R.string.app_name)) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(
                                imageVector = Icons.Filled.Menu,
                                contentDescription = stringResource(R.string.action_open_menu),
                            )
                        }
                    },
                    actions = {
                        IconButton(onClick = onOpenProgress) {
                            BarChartIcon(
                                tint = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.semantics {
                                    contentDescription = progressDescription
                                },
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
                    .padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                ErrorBanner(message = error)

                // The board takes whatever vertical space is left after the
                // banner, the status strip and the keypad have had theirs. That
                // is what stops the keypad ever being pushed off-screen: the
                // grid shrinks its tiles instead.
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .semantics { contentDescription = boardDescription },
                    contentAlignment = Alignment.Center,
                ) {
                    TileGrid(
                        rows = rows,
                        shakeRowIndex = activeRowIndex,
                        shakeTrigger = errorId,
                    )
                }

                GameOverStrip(
                    status = status,
                    guessesUsed = guessesUsed,
                    target = target,
                    onNewGame = onNewGame,
                )

                Spacer(Modifier.height(10.dp))

                Keypad(
                    keyStates = keyStates,
                    onKeyPress = onKeyPress,
                    onDelete = onDelete,
                    onSubmit = onSubmit,
                    canSubmit = canSubmit,
                    canDelete = canDelete,
                    enabled = inProgress,
                )

                Spacer(Modifier.height(12.dp))
            }
        }
    }
}

/** Occupies zero height while the game is live, so the board keeps the space. */
@Composable
private fun GameOverStrip(
    status: GameStatus,
    guessesUsed: Int,
    target: String?,
    onNewGame: () -> Unit,
) {
    if (status == GameStatus.IN_PROGRESS) return

    val message = when (status) {
        GameStatus.WON -> stringResource(R.string.game_won, guessesUsed)
        GameStatus.LOST -> stringResource(R.string.game_lost, target.orEmpty())
        GameStatus.IN_PROGRESS -> ""
    }

    LayoutRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Start,
            modifier = Modifier.weight(1f),
        )
        Button(onClick = onNewGame) {
            Text(stringResource(R.string.game_play_again))
        }
    }
}

/* ------------------------------------------------------------------------ */
/* Previews — fake state only, nothing from logic/                           */
/* ------------------------------------------------------------------------ */

/** Pads to a full 8-tile row so previews honour the Row invariant. */
internal fun previewRow(text: String, states: List<TileState>): Row {
    val tiles = (0 until EQUATION_LENGTH).map { i ->
        val c = text.getOrNull(i)
        when {
            c == null -> Tile(null, TileState.EMPTY)
            else -> Tile(c, states.getOrElse(i) { TileState.FILLED })
        }
    }
    return Row(tiles)
}

internal fun previewBoard(): List<Row> {
    val g = TileState.CORRECT
    val p = TileState.PRESENT
    val a = TileState.ABSENT
    return listOf(
        previewRow("12+34=46", listOf(a, p, g, a, a, g, a, p)),
        previewRow("9*8-2=70", listOf(a, a, g, a, p, g, a, p)),
        previewRow("48/6=8+0", listOf(g, g, g, p, g, a, a, a)),
        previewRow("7+5", emptyList()),
        previewRow("", emptyList()),
        previewRow("", emptyList()),
    )
}

internal fun previewKeyStates(): Map<Char, TileState> = mapOf(
    '1' to TileState.ABSENT,
    '2' to TileState.PRESENT,
    '3' to TileState.ABSENT,
    '4' to TileState.CORRECT,
    '6' to TileState.PRESENT,
    '8' to TileState.CORRECT,
    '9' to TileState.ABSENT,
    '0' to TileState.ABSENT,
    '+' to TileState.CORRECT,
    '*' to TileState.ABSENT,
    '/' to TileState.PRESENT,
    '=' to TileState.CORRECT,
)

@Preview(name = "Game - light", widthDp = 360, heightDp = 720, showBackground = true)
@Composable
private fun GameScreenLightPreview() {
    NerdierTheme(darkTheme = false) {
        GameScreen(
            rows = previewBoard(),
            keyStates = previewKeyStates(),
            error = null,
            status = GameStatus.IN_PROGRESS,
            guessesUsed = 3,
            target = null,
            onKeyPress = {}, onDelete = {}, onSubmit = {}, onNewGame = {},
            onOpenRules = {}, onOpenProgress = {},
        )
    }
}

@Preview(name = "Game - dark", widthDp = 360, heightDp = 720, showBackground = true)
@Composable
private fun GameScreenDarkPreview() {
    NerdierTheme(darkTheme = true) {
        GameScreen(
            rows = previewBoard(),
            keyStates = previewKeyStates(),
            error = null,
            status = GameStatus.IN_PROGRESS,
            guessesUsed = 3,
            target = null,
            onKeyPress = {}, onDelete = {}, onSubmit = {}, onNewGame = {},
            onOpenRules = {}, onOpenProgress = {},
        )
    }
}

@Preview(name = "Game - error + small screen", widthDp = 360, heightDp = 592, showBackground = true)
@Composable
private fun GameScreenErrorPreview() {
    NerdierTheme(darkTheme = false) {
        GameScreen(
            rows = previewBoard(),
            keyStates = previewKeyStates(),
            error = "That is not a true equation: 7+5 does not equal 13.",
            errorId = 1,
            status = GameStatus.IN_PROGRESS,
            guessesUsed = 3,
            target = null,
            onKeyPress = {}, onDelete = {}, onSubmit = {}, onNewGame = {},
            onOpenRules = {}, onOpenProgress = {},
        )
    }
}

@Preview(name = "Game - lost", widthDp = 360, heightDp = 720, showBackground = true)
@Composable
private fun GameScreenLostPreview() {
    NerdierTheme(darkTheme = true) {
        GameScreen(
            rows = previewBoard(),
            keyStates = previewKeyStates(),
            error = null,
            status = GameStatus.LOST,
            guessesUsed = 6,
            target = "48/6=8+0",
            onKeyPress = {}, onDelete = {}, onSubmit = {}, onNewGame = {},
            onOpenRules = {}, onOpenProgress = {},
        )
    }
}

@Preview(name = "Keypad - light", widthDp = 360, showBackground = true)
@Composable
private fun KeypadLightPreview() {
    NerdierTheme(darkTheme = false) {
        Keypad(
            keyStates = previewKeyStates(),
            onKeyPress = {}, onDelete = {}, onSubmit = {},
            modifier = Modifier.padding(16.dp),
        )
    }
}

@Preview(name = "Keypad - dark", widthDp = 360, showBackground = true)
@Composable
private fun KeypadDarkPreview() {
    NerdierTheme(darkTheme = true) {
        Keypad(
            keyStates = previewKeyStates(),
            onKeyPress = {}, onDelete = {}, onSubmit = {},
            modifier = Modifier.padding(16.dp),
        )
    }
}

@Preview(name = "Board only - dark", widthDp = 360, heightDp = 320, showBackground = true)
@Composable
private fun BoardDarkPreview() {
    NerdierTheme(darkTheme = true) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            TileGrid(rows = previewBoard())
        }
    }
}

@Preview(name = "Board only - light", widthDp = 360, heightDp = 320, showBackground = true)
@Composable
private fun BoardLightPreview() {
    NerdierTheme(darkTheme = false) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            TileGrid(rows = previewBoard())
        }
    }
}
