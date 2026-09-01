package com.nerdier.game.model

/** Every Nerdier equation — target and guess alike — is exactly this many tiles. */
const val EQUATION_LENGTH = 8

/** The player gets this many submitted guesses. Invalid submissions do not count. */
const val MAX_GUESSES = 6

/** Characters the player may enter. Order matters: it drives keypad layout. */
val DIGITS: List<Char> = ('0'..'9').toList()
val OPERATORS: List<Char> = listOf('+', '-', '*', '/')
const val EQUALS: Char = '='
val ALL_CHARS: List<Char> = DIGITS + OPERATORS + EQUALS

/**
 * Colour semantics for a single tile.
 *
 * EMPTY   — nothing typed yet.
 * FILLED  — typed but not yet submitted; no information revealed.
 * CORRECT — right character in the right position (green).
 * PRESENT — character occurs in the target but not here (purple).
 * ABSENT  — character does not occur in the target, or its occurrences are
 *           already accounted for by CORRECT/PRESENT tiles elsewhere (black).
 */
enum class TileState { EMPTY, FILLED, CORRECT, PRESENT, ABSENT }

/** Ranking used to upgrade keypad colours monotonically; higher never downgrades. */
val TileState.rank: Int
    get() = when (this) {
        TileState.EMPTY -> 0
        TileState.FILLED -> 1
        TileState.ABSENT -> 2
        TileState.PRESENT -> 3
        TileState.CORRECT -> 4
    }

data class Tile(val char: Char? = null, val state: TileState = TileState.EMPTY)

/** A single board row: always EQUATION_LENGTH tiles. */
data class Row(val tiles: List<Tile> = List(EQUATION_LENGTH) { Tile() }) {
    val text: String get() = tiles.mapNotNull { it.char }.joinToString("")
    val isFull: Boolean get() = tiles.count { it.char != null } == EQUATION_LENGTH
}

/** Result of validating a candidate equation string. */
sealed interface ValidationResult {
    data object Valid : ValidationResult
    /** [reason] is shown verbatim to the player, so make it specific. */
    data class Invalid(val reason: String) : ValidationResult
}

/** Outcome of submitting a full row. */
sealed interface GuessResult {
    data class Valid(val tiles: List<Tile>, val won: Boolean) : GuessResult
    data class Invalid(val reason: String) : GuessResult
}

enum class GameStatus { IN_PROGRESS, WON, LOST }
