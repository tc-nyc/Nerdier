package com.nerdier.game

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.nerdier.game.data.StatsRepository
import com.nerdier.game.data.StatsSummaries
import com.nerdier.game.logic.GameViewModel
import com.nerdier.game.ui.screens.GameScreen
import com.nerdier.game.ui.screens.ProgressScreen
import com.nerdier.game.ui.screens.RulesScreen
import com.nerdier.game.ui.screens.toPeriodStatsUi
import kotlinx.coroutines.delay

/** How long a validator error stays on screen before it is cleared. */
private const val ERROR_VISIBLE_MILLIS = 2_600L

private object Routes {
    const val GAME = "game"
    const val RULES = "rules"
    const val PROGRESS = "progress"
}

/**
 * Composition root: joins the coder's [GameViewModel] to the designer's stateless
 * screens. This is the only file that knows about both halves.
 *
 * The ViewModel is hoisted above the [NavHost] on purpose — scoping it to the
 * `game` destination would deal a brand-new puzzle every time the player came
 * back from the Rules or Progress screen.
 */
@Composable
fun NerdierApp(
    statsRepository: StatsRepository,
    navController: NavHostController = rememberNavController(),
) {
    val viewModel: GameViewModel = viewModel(
        factory = GameViewModel.factory(statsRepository)
    )
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    // ErrorBanner renders whatever it is given and never dismisses itself, so
    // retiring the message is the root's job. Keyed on errorId rather than on the
    // text: two identical rejections in a row must each get their own full
    // display window instead of the second being swallowed.
    LaunchedEffect(state.errorId) {
        if (state.errorMessage != null) {
            delay(ERROR_VISIBLE_MILLIS)
            viewModel.onErrorShown()
        }
    }

    NavHost(navController = navController, startDestination = Routes.GAME) {

        composable(Routes.GAME) {
            GameScreen(
                rows = state.rows,
                keyStates = state.keypad,
                error = state.errorMessage,
                status = state.status,
                guessesUsed = state.guessesUsed,
                target = state.target,
                currentRow = state.currentRow,
                errorId = state.errorId,
                onKeyPress = viewModel::onKeyPress,
                onDelete = viewModel::onDelete,
                onSubmit = viewModel::onSubmit,
                onNewGame = viewModel::onNewGame,
                onOpenRules = { navController.navigate(Routes.RULES) },
                onOpenProgress = { navController.navigate(Routes.PROGRESS) },
            )
        }

        composable(Routes.RULES) {
            RulesScreen(onBack = { navController.popBackStack() })
        }

        composable(Routes.PROGRESS) {
            // Re-collected on entry so a game finished since the last visit is
            // already counted.
            val summaries by statsRepository.summaries()
                .collectAsStateWithLifecycle(initialValue = StatsSummaries())

            ProgressScreen(
                today = summaries.today.toPeriodStatsUi(),
                thisWeek = summaries.thisWeek.toPeriodStatsUi(),
                thisMonth = summaries.thisMonth.toPeriodStatsUi(),
                onBack = { navController.popBackStack() },
            )
        }
    }
}
