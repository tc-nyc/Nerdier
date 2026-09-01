package com.nerdier.game.logic

import com.nerdier.game.model.EQUATION_LENGTH
import com.nerdier.game.model.Tile
import com.nerdier.game.model.TileState
import com.nerdier.game.model.rank

/**
 * Tile colouring for a submitted guess.
 *
 * Pure Kotlin — no Android runtime, no Compose. Safe to unit test on the JVM.
 *
 * The rule is the Wordle rule, applied uniformly to digits, operators and `=`:
 * **two passes over the row, with a per-character budget drawn from the target.**
 *
 *  - Pass 1 walks every position and marks the exact positional matches CORRECT,
 *    consuming one unit of that character's budget.
 *  - Pass 2 walks the leftovers. A character is PRESENT only while budget that
 *    survived pass 1 remains; once that budget is exhausted the remaining copies
 *    are ABSENT.
 *
 * The ordering is load-bearing. A one-pass `target.contains(c)` test scores
 * duplicates wrong in both directions: it over-colours a guess that repeats a
 * character the target holds only once, and it steals budget from a later
 * positional match. Worked example — target `12+34=46`, guess `44+11=55`:
 * the target holds two `4`s (positions 4 and 6) but only one `1`, so both
 * guessed `4`s come back PRESENT while the *second* guessed `1` comes back
 * ABSENT. Result: `P P G P - G - -`.
 */
object Scorer {

    /**
     * Scores [guess] against [target]. Both must be the same length; in this game
     * that is always [EQUATION_LENGTH].
     *
     * @return one [Tile] per character of [guess], each carrying that character and
     *   a state of CORRECT, PRESENT or ABSENT. Never EMPTY or FILLED.
     */
    fun score(guess: String, target: String): List<Tile> {
        require(guess.length == target.length) {
            "score() needs equal lengths: guess='$guess' (${guess.length}) " +
                "target='$target' (${target.length})"
        }

        val states = arrayOfNulls<TileState>(guess.length)

        // Remaining, unconsumed occurrences of each character in the target.
        val remaining = HashMap<Char, Int>(guess.length * 2)
        for (c in target) remaining[c] = (remaining[c] ?: 0) + 1

        // Pass 1 — exact positional matches claim their budget before anything else.
        for (i in guess.indices) {
            if (guess[i] == target[i]) {
                states[i] = TileState.CORRECT
                remaining[guess[i]] = remaining.getValue(guess[i]) - 1
            }
        }

        // Pass 2 — misplaced characters draw only on the budget pass 1 left behind.
        for (i in guess.indices) {
            if (states[i] != null) continue
            val c = guess[i]
            val left = remaining[c] ?: 0
            if (left > 0) {
                states[i] = TileState.PRESENT
                remaining[c] = left - 1
            } else {
                states[i] = TileState.ABSENT
            }
        }

        return guess.mapIndexed { i, c -> Tile(char = c, state = states[i]!!) }
    }

    /**
     * Folds a freshly scored row into the keypad colouring.
     *
     * Monotonic by construction: a key's state may only ever improve along
     * ABSENT -> PRESENT -> CORRECT (see [rank]) and never regresses. Without this,
     * a later guess that puts a known-green character in the wrong column would
     * downgrade its key from green to purple and mislead the player.
     *
     * @return a new map; [current] is not mutated.
     */
    fun updateKeypad(current: Map<Char, TileState>, tiles: List<Tile>): Map<Char, TileState> {
        val next = HashMap(current)
        for (tile in tiles) {
            val c = tile.char ?: continue
            val existing = next[c]
            if (existing == null || tile.state.rank > existing.rank) {
                next[c] = tile.state
            }
        }
        return next
    }
}
