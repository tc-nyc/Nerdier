package com.nerdier.game.logic

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.nerdier.game.data.GameRecord
import com.nerdier.game.data.StatsRepository
import com.nerdier.game.model.EQUATION_LENGTH
import com.nerdier.game.model.GameStatus
import com.nerdier.game.model.GuessResult
import com.nerdier.game.model.MAX_GUESSES
import com.nerdier.game.model.Row
import com.nerdier.game.model.TileState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.random.Random

/**
 * Everything the board screen needs to draw itself. Immutable; replaced wholesale
 * on every change.
 *
 * @param rows all [MAX_GUESSES] rows, consumed ones scored, the active one FILLED,
 *   the rest EMPTY.
 * @param currentRow index of the row being typed; equals [MAX_GUESSES] once the board is full.
 * @param keypad per-key colour, upgraded monotonically. Keys absent from the map
 *   have not been guessed yet.
 * @param errorMessage transient, player-facing. The UI shows it then calls
 *   [GameViewModel.onErrorShown].
 * @param errorId increments on every new error, so the UI re-shows two identical
 *   messages in a row instead of swallowing the second. Feed it straight to
 *   `TileGrid(shakeTrigger = ...)` together with `shakeRowIndex = currentRow`.
 * @param target the answer — **null until the game is over**, so no screen can leak it.
 */
data class GameUiState(
    val rows: List<Row> = List(MAX_GUESSES) { Row() },
    val currentRow: Int = 0,
    val keypad: Map<Char, TileState> = emptyMap(),
    val status: GameStatus = GameStatus.IN_PROGRESS,
    val guessesUsed: Int = 0,
    val errorMessage: String? = null,
    val errorId: Int = 0,
    val target: String? = null,
) {
    val isGameOver: Boolean get() = status != GameStatus.IN_PROGRESS

    val guessesRemaining: Int get() = MAX_GUESSES - guessesUsed

    /** Characters typed into the active row so far. */
    val currentInput: String
        get() = if (currentRow in rows.indices) rows[currentRow].text else ""

    /** Enter is only meaningful once the row is full and the game is live. */
    val canSubmit: Boolean
        get() = !isGameOver && currentInput.length == EQUATION_LENGTH

    /** Backspace is only meaningful when the active row has something in it. */
    val canDelete: Boolean
        get() = !isGameOver && currentInput.isNotEmpty()
}

/**
 * Drives one game and records the result.
 *
 * No Compose imports here — the UI observes [uiState] and calls the intent
 * functions; it never mutates state itself.
 */
class GameViewModel(
    private val statsRepository: StatsRepository,
    private val rules: EquationRules = RealEquationRules,
    private val random: Random = Random.Default,
    private val nowMillis: () -> Long = System::currentTimeMillis,
) : ViewModel() {

    private var engine: GameEngine = GameEngine(random = random, rules = rules)

    private val _uiState = MutableStateFlow(stateFrom(engine))
    val uiState: StateFlow<GameUiState> = _uiState.asStateFlow()

    private var nextErrorId: Int = 1

    fun onKeyPress(c: Char) {
        engine.keyPress(c)
        publish()
    }

    fun onDelete() {
        engine.delete()
        publish()
    }

    fun onSubmit() {
        val statusBefore = engine.status
        when (val result = engine.submit()) {
            is GuessResult.Invalid -> {
                // Row not consumed, no guess spent — just tell the player why.
                publish(error = result.reason)
                return
            }
            is GuessResult.Valid -> {
                publish()
                // The engine decides `won` (identical OR commutatively equivalent);
                // we only read it. Never re-derive it from tile colours here.
                if (statusBefore == GameStatus.IN_PROGRESS && engine.status != GameStatus.IN_PROGRESS) {
                    recordFinishedGame(won = result.won, guessesUsed = engine.guessesUsed)
                }
            }
        }
    }

    /** Abandons the current game and deals a new target. An unfinished game is not recorded. */
    fun onNewGame() {
        engine = GameEngine(random = random, rules = rules)
        _uiState.value = stateFrom(engine)
    }

    /** Called by the UI once [GameUiState.errorMessage] has been displayed. */
    fun onErrorShown() {
        _uiState.update { if (it.errorMessage == null) it else it.copy(errorMessage = null) }
    }

    private fun recordFinishedGame(won: Boolean, guessesUsed: Int) {
        val record = GameRecord(
            timestampMillis = nowMillis(),
            won = won,
            guessesUsed = guessesUsed,
        )
        viewModelScope.launch { statsRepository.record(record) }
    }

    private fun publish(error: String? = null) {
        val id = if (error != null) nextErrorId++ else _uiState.value.errorId
        _uiState.value = stateFrom(engine, error, id)
    }

    private fun stateFrom(
        engine: GameEngine,
        error: String? = null,
        errorId: Int = 0,
    ): GameUiState {
        val snapshot = engine.snapshot()
        return GameUiState(
            rows = snapshot.rows,
            currentRow = snapshot.currentRow,
            keypad = snapshot.keypad,
            status = snapshot.status,
            guessesUsed = snapshot.guessesUsed,
            errorMessage = error,
            errorId = errorId,
            // Revealed only once the game is over — WON or LOST.
            target = if (snapshot.status == GameStatus.IN_PROGRESS) null else engine.target,
        )
    }

    companion object {
        /**
         * For the composition root:
         * `viewModel(factory = GameViewModel.factory(defaultStatsRepository(context)))`
         */
        fun factory(statsRepository: StatsRepository): ViewModelProvider.Factory =
            viewModelFactory {
                initializer { GameViewModel(statsRepository) }
            }
    }
}
