package com.nerdier.game

import com.nerdier.game.logic.Scorer
import com.nerdier.game.model.Tile
import com.nerdier.game.model.TileState
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Scoring is the highest-risk code in the app, and duplicate characters are where
 * it breaks. Each case is written as a compact pattern string so the expected
 * colouring is readable at a glance:
 *
 *   G = CORRECT, P = PRESENT, - = ABSENT
 */
class ScorerTest {

    private fun pattern(tiles: List<Tile>): String = tiles.joinToString("") {
        when (it.state) {
            TileState.CORRECT -> "G"
            TileState.PRESENT -> "P"
            TileState.ABSENT -> "-"
            else -> "?"
        }
    }

    private fun assertScored(target: String, guess: String, expected: String) {
        assertEquals(
            "target=$target guess=$guess",
            expected,
            pattern(Scorer.score(guess, target))
        )
    }

    @Test
    fun `identical guess is all green`() {
        assertScored(target = "12+34=46", guess = "12+34=46", expected = "GGGGGGGG")
    }

    @Test
    fun `duplicate budget is spent left to right`() {
        // Target holds two 4s but only one 1. Both guessed 4s are PRESENT; the
        // FIRST guessed 1 is PRESENT and the SECOND is ABSENT. A naive
        // target.contains() check marks that second 1 PRESENT and is wrong.
        assertScored(target = "12+34=46", guess = "44+11=55", expected = "PPGP-G--")
    }

    @Test
    fun `exact matches claim budget before misplaced ones`() {
        // The 4 in position 1 is exact. The leading 4 may only draw on what is left.
        assertScored(target = "44+11=55", guess = "14+41=55", expected = "PGGPGGGG")
    }

    @Test
    fun `over-guessing a repeated character exhausts its budget`() {
        // Guess has five 2s; target "10+2=012" has only two.
        assertScored(target = "10+2=012", guess = "22222=22", expected = "---G-P-G")
    }

    @Test
    fun `operators and equals are scored under the same budget rule`() {
        // Target has two + and one =; guess has two + and one =.
        assertScored(target = "5+5+5=15", guess = "1+5+9=15", expected = "-GGG-GGG")
    }

    @Test
    fun `operator budget is not unlimited`() {
        // Target "1+2+3=06" has two +; guess "9+9+9=99" also has two, both aligned.
        assertScored(target = "1+2+3=06", guess = "9+9+9=99", expected = "-G-G-G--")
    }

    @Test
    fun `perfect anagram with no positional match is all purple`() {
        assertScored(target = "12+3=345", guess = "543=3+21", expected = "PPPPPPPP")
    }

    @Test
    fun `nothing in common is all black except aligned equals`() {
        assertScored(target = "12+34=46", guess = "9*9-8=73", expected = "-----G-P")
    }

    @Test
    fun `keypad state never regresses`() {
        var keypad = emptyMap<Char, TileState>()

        // First guess: 4 lands misplaced -> PRESENT.
        keypad = Scorer.updateKeypad(keypad, Scorer.score("44+11=55", "12+34=46"))
        assertEquals(TileState.PRESENT, keypad['4'])

        // Second guess: 4 lands exactly -> upgrades to CORRECT.
        keypad = Scorer.updateKeypad(keypad, Scorer.score("12+34=46", "12+34=46"))
        assertEquals(TileState.CORRECT, keypad['4'])

        // Third guess puts 4 in the wrong column again. It must NOT drop back.
        keypad = Scorer.updateKeypad(keypad, Scorer.score("44+11=55", "12+34=46"))
        assertEquals("green key must not downgrade to purple", TileState.CORRECT, keypad['4'])
    }

    @Test
    fun `absent never overwrites a known present`() {
        var keypad = mapOf('7' to TileState.PRESENT)
        keypad = Scorer.updateKeypad(keypad, listOf(Tile('7', TileState.ABSENT)))
        assertEquals(TileState.PRESENT, keypad['7'])
    }
}
