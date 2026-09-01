package com.nerdier.game.logic

import com.nerdier.game.math.EquationEngine
import com.nerdier.game.model.ALL_CHARS
import com.nerdier.game.model.EQUATION_LENGTH
import com.nerdier.game.model.GameStatus
import com.nerdier.game.model.GuessResult
import com.nerdier.game.model.MAX_GUESSES
import com.nerdier.game.model.Row
import com.nerdier.game.model.Tile
import com.nerdier.game.model.TileState
import com.nerdier.game.model.ValidationResult
import kotlin.random.Random

/**
 * Arithmetic rules the engine depends on.
 *
 * This is a thin seam over the math-wizard's `object EquationEngine`, not a
 * second implementation of it. It exists so [GameEngine] can be unit tested with
 * a stub on a plain JVM, and so the whole engine has exactly one place that
 * touches the arithmetic package.
 */
interface EquationRules {
    fun generate(random: Random): String
    fun validate(guess: String): ValidationResult
    fun isCommutativelyEquivalent(a: String, b: String): Boolean
}

/** The production rules: delegates straight through to the math-wizard's engine. */
object RealEquationRules : EquationRules {
    override fun generate(random: Random): String = EquationEngine.generate(random)
    override fun validate(guess: String): ValidationResult = EquationEngine.validate(guess)
    override fun isCommutativelyEquivalent(a: String, b: String): Boolean =
        EquationEngine.isCommutativelyEquivalent(a, b)
}

/** Immutable read-only view of the board, handed up to the ViewModel. */
data class EngineSnapshot(
    val rows: List<Row>,
    val currentRow: Int,
    val keypad: Map<Char, TileState>,
    val status: GameStatus,
    val guessesUsed: Int,
)

/**
 * The Nerdier game state machine.
 *
 * Pure Kotlin: no Android imports, no coroutines, no Compose. Single-threaded by
 * contract — the ViewModel is its only caller and drives it from the main thread.
 *
 * @param target the 8-character answer. Defaults to a freshly generated equation.
 */
class GameEngine(
    val target: String,
    private val rules: EquationRules = RealEquationRules,
) {

    constructor(
        random: Random = Random.Default,
        rules: EquationRules = RealEquationRules,
    ) : this(rules.generate(random), rules)

    private val rows: MutableList<Row> = MutableList(MAX_GUESSES) { Row() }

    /** Index of the row currently being typed. Equals [MAX_GUESSES] once the board is full. */
    var currentRow: Int = 0
        private set

    var keypad: Map<Char, TileState> = emptyMap()
        private set

    var status: GameStatus = GameStatus.IN_PROGRESS
        private set

    /** Rows actually consumed. Invalid submissions never increment this. */
    var guessesUsed: Int = 0
        private set

    init {
        require(target.length == EQUATION_LENGTH) {
            "target must be $EQUATION_LENGTH characters, was '${target}' (${target.length})"
        }
    }

    fun snapshot(): EngineSnapshot = EngineSnapshot(
        rows = rows.toList(),
        currentRow = currentRow,
        keypad = keypad,
        status = status,
        guessesUsed = guessesUsed,
    )

    /** Text typed into the active row so far, or "" when the board is finished. */
    private fun currentText(): String =
        if (currentRow in rows.indices) rows[currentRow].text else ""

    /**
     * Appends [c] to the active row. Ignored when the game is over, the row is
     * already full, or [c] is not a key the player actually has.
     */
    fun keyPress(c: Char) {
        if (status != GameStatus.IN_PROGRESS) return
        if (currentRow !in rows.indices) return
        if (c !in ALL_CHARS) return

        val text = currentText()
        if (text.length >= EQUATION_LENGTH) return
        writeCurrentRow(text + c)
    }

    /** Removes the last character of the active row. No undo beyond the current row. */
    fun delete() {
        if (status != GameStatus.IN_PROGRESS) return
        if (currentRow !in rows.indices) return

        val text = currentText()
        if (text.isEmpty()) return
        writeCurrentRow(text.dropLast(1))
    }

    /** Repaints the active row as FILLED/EMPTY tiles. Only ever touches the active row. */
    private fun writeCurrentRow(text: String) {
        rows[currentRow] = Row(
            List(EQUATION_LENGTH) { i ->
                if (i < text.length) Tile(text[i], TileState.FILLED) else Tile()
            }
        )
    }

    /**
     * Submits the active row.
     *
     * - Game already over -> [GuessResult.Invalid], nothing changes.
     * - Fewer than [EQUATION_LENGTH] characters -> [GuessResult.Invalid]; the row is NOT
     *   consumed and no guess is spent.
     * - Rejected by [EquationRules.validate] -> [GuessResult.Invalid] carrying the
     *   validator's reason **verbatim**; the row is NOT consumed and no guess is
     *   spent. The player edits in place and resubmits.
     * - Accepted -> the row is scored, consumed, and the win check runs.
     */
    fun submit(): GuessResult {
        if (status != GameStatus.IN_PROGRESS) {
            return GuessResult.Invalid("This game is over. Start a new game to keep playing.")
        }
        if (currentRow !in rows.indices) {
            return GuessResult.Invalid("No guesses left.")
        }

        val guess = currentText()
        if (guess.length < EQUATION_LENGTH) {
            val missing = EQUATION_LENGTH - guess.length
            return GuessResult.Invalid(
                "Fill all $EQUATION_LENGTH tiles — $missing to go."
            )
        }

        when (val validation = rules.validate(guess)) {
            is ValidationResult.Invalid ->
                // Surfaced verbatim: the math-wizard writes the player-facing wording.
                return GuessResult.Invalid(validation.reason)
            ValidationResult.Valid -> Unit
        }

        val tiles = Scorer.score(guess, target)

        // WIN TEST — deliberately independent of the tile colours.
        //
        // A commutative win (guess `34+12=46` against target `12+34=46`) is a win
        // even though several of its tiles score PRESENT rather than CORRECT.
        // Inferring `won` from "every tile is CORRECT" would call that a miss, so
        // the decision is delegated to the arithmetic layer and never re-derived
        // from `tiles`. Do not "simplify" this to a tiles.all { CORRECT } check.
        val won = guess == target || rules.isCommutativelyEquivalent(guess, target)

        // Consume the row.
        rows[currentRow] = Row(tiles)
        keypad = Scorer.updateKeypad(keypad, tiles)
        currentRow += 1
        guessesUsed += 1

        status = when {
            won -> GameStatus.WON
            guessesUsed >= MAX_GUESSES -> GameStatus.LOST
            else -> GameStatus.IN_PROGRESS
        }

        return GuessResult.Valid(tiles = tiles, won = won)
    }
}
