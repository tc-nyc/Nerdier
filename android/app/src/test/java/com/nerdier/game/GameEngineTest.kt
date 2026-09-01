package com.nerdier.game

import com.nerdier.game.logic.EquationRules
import com.nerdier.game.logic.GameEngine
import com.nerdier.game.model.GameStatus
import com.nerdier.game.model.GuessResult
import com.nerdier.game.model.MAX_GUESSES
import com.nerdier.game.model.TileState
import com.nerdier.game.model.ValidationResult
import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Engine behaviour, driven through a stubbed [EquationRules] so these tests are
 * independent of the arithmetic implementation and run on a plain JVM.
 */
class GameEngineTest {

    /** Accepts anything in [accept]; rejects everything else with a fixed reason. */
    private class StubRules(
        private val accept: Set<String>,
        private val equivalent: Set<Pair<String, String>> = emptySet(),
        private val reason: String = "Nope, that doesn't add up.",
    ) : EquationRules {
        override fun generate(random: Random): String = "12+34=46"
        override fun validate(guess: String): ValidationResult =
            if (guess in accept) ValidationResult.Valid
            else ValidationResult.Invalid(reason)
        override fun isCommutativelyEquivalent(a: String, b: String): Boolean =
            a == b || (a to b) in equivalent || (b to a) in equivalent
    }

    private fun GameEngine.type(text: String) = text.forEach { keyPress(it) }

    // ---- row consumption ----------------------------------------------------

    @Test
    fun `short row is rejected and does not consume a guess`() {
        val engine = GameEngine("12+34=46", StubRules(setOf("12+34=46")))
        engine.type("12+34")

        val result = engine.submit()

        assertTrue(result is GuessResult.Invalid)
        assertEquals(0, engine.guessesUsed)
        assertEquals(0, engine.currentRow)
        assertEquals(GameStatus.IN_PROGRESS, engine.status)
    }

    @Test
    fun `invalid equation does not consume a guess and the row stays editable`() {
        val engine = GameEngine("12+34=46", StubRules(setOf("12+34=46")))
        engine.type("51+21=42")

        val result = engine.submit()

        assertTrue(result is GuessResult.Invalid)
        assertEquals("no guess may be spent on a rejected equation", 0, engine.guessesUsed)
        assertEquals(0, engine.currentRow)

        // The row is still editable in place: delete a character and resubmit.
        engine.delete()
        engine.keyPress('6')
        assertEquals("51+21=46", engine.snapshot().rows[0].text)
    }

    @Test
    fun `validator reason is surfaced verbatim`() {
        val reason = "51+21=42 — the left side equals 72"
        val engine = GameEngine("12+34=46", StubRules(emptySet(), reason = reason))
        engine.type("51+21=42")

        val result = engine.submit() as GuessResult.Invalid

        assertEquals(reason, result.reason)
    }

    @Test
    fun `only valid submissions advance the row`() {
        val engine = GameEngine("12+34=46", StubRules(setOf("11+11=22")))

        repeat(3) {
            engine.type("99999999")
            engine.submit()
            repeat(8) { engine.delete() }
        }
        assertEquals(0, engine.guessesUsed)

        engine.type("11+11=22")
        engine.submit()
        assertEquals(1, engine.guessesUsed)
        assertEquals(1, engine.currentRow)
    }

    // ---- winning ------------------------------------------------------------

    @Test
    fun `exact guess wins`() {
        val engine = GameEngine("12+34=46", StubRules(setOf("12+34=46")))
        engine.type("12+34=46")

        val result = engine.submit() as GuessResult.Valid

        assertTrue(result.won)
        assertEquals(GameStatus.WON, engine.status)
    }

    @Test
    fun `commutative rearrangement wins even though tiles are not all green`() {
        // This is the bug the whole design guards against: a win that does NOT
        // look like a win on the board.
        val engine = GameEngine(
            target = "12+34=46",
            rules = StubRules(
                accept = setOf("34+12=46"),
                equivalent = setOf("34+12=46" to "12+34=46"),
            ),
        )
        engine.type("34+12=46")

        val result = engine.submit() as GuessResult.Valid

        assertTrue("commutative guess must win", result.won)
        assertEquals(GameStatus.WON, engine.status)
        assertFalse(
            "precondition: this guess is deliberately not all-green",
            result.tiles.all { it.state == TileState.CORRECT }
        )
    }

    @Test
    fun `non-commutative rearrangement does not win`() {
        // Subtraction does not commute: 8-3=5 must not be satisfied by 3-8=5.
        val engine = GameEngine("83-78=05", StubRules(setOf("78-83=05")))
        engine.type("78-83=05")

        val result = engine.submit() as GuessResult.Valid

        assertFalse(result.won)
        assertNotEquals(GameStatus.WON, engine.status)
    }

    // ---- losing -------------------------------------------------------------

    @Test
    fun `six consumed rows without a win loses`() {
        val engine = GameEngine("12+34=46", StubRules(setOf("11+11=22")))

        repeat(MAX_GUESSES) {
            engine.type("11+11=22")
            val r = engine.submit()
            assertTrue(r is GuessResult.Valid)
            repeat(8) { engine.delete() }
        }

        assertEquals(MAX_GUESSES, engine.guessesUsed)
        assertEquals(GameStatus.LOST, engine.status)
        assertEquals("target is revealed on loss", "12+34=46", engine.target)
    }

    @Test
    fun `input is ignored once the game is over`() {
        val engine = GameEngine("12+34=46", StubRules(setOf("12+34=46")))
        engine.type("12+34=46")
        engine.submit()

        engine.keyPress('9')
        assertTrue(engine.submit() is GuessResult.Invalid)
        assertEquals(1, engine.guessesUsed)
    }

    // ---- typing -------------------------------------------------------------

    @Test
    fun `row will not overflow past eight characters`() {
        val engine = GameEngine("12+34=46", StubRules(emptySet()))
        engine.type("123456789999")
        assertEquals(8, engine.snapshot().rows[0].text.length)
    }

    @Test
    fun `delete on an empty row is a no-op`() {
        val engine = GameEngine("12+34=46", StubRules(emptySet()))
        repeat(5) { engine.delete() }
        assertEquals("", engine.snapshot().rows[0].text)
    }
}
