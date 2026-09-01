package com.nerdier.game

import com.nerdier.game.math.EquationEngine
import com.nerdier.game.model.EQUATION_LENGTH
import com.nerdier.game.model.ValidationResult
import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The arithmetic layer: generation, validation, evaluation, commutativity. */
class EquationEngineTest {

    private fun accepts(s: String) = EquationEngine.validate(s) is ValidationResult.Valid
    private fun reason(s: String) = (EquationEngine.validate(s) as ValidationResult.Invalid).reason

    // ---- validation ---------------------------------------------------------

    @Test
    fun `accepts well formed equations`() {
        listOf("12+34=46", "12*9=108", "100-1=99", "100/2=50", "1+9/1=10")
            .forEach { assertTrue("should accept $it", accepts(it)) }
    }

    @Test
    fun `rejects arithmetic that does not balance`() {
        assertFalse(accepts("51+21=42"))
        // The message must name the real value, not just say "invalid".
        assertTrue("reason was: ${reason("51+21=42")}", reason("51+21=42").contains("72"))
    }

    @Test
    fun `rejects wrong length`() {
        assertFalse(accepts("1+2=3"))
        assertFalse(accepts("123+456=579"))
    }

    @Test
    fun `requires exactly one equals sign`() {
        assertFalse(accepts("12+34946"))
        assertFalse(accepts("1+2=3=48"))
    }

    @Test
    fun `rejects operators on the right hand side`() {
        assertFalse(accepts("12=34-22"))
    }

    @Test
    fun `rejects inexact division and division by zero`() {
        assertFalse("100/8 is 12.5, not a whole number", accepts("100/8=12"))
        assertFalse("division by zero", accepts("12/0=120"))
    }

    @Test
    fun `rejects negative intermediate results`() {
        // 0-1 dips to -1 before +10 brings it back to a legitimate 9. The final
        // value is correct and every other rule is satisfied, so this equation is
        // rejected for the intermediate alone.
        assertFalse(accepts("0-1+10=9"))
        assertFalse(accepts("0-2+10=8"))
    }

    @Test
    fun `rejects leading zeros`() {
        assertFalse(accepts("05+1=006"))
        assertFalse(accepts("5+05=010"))
    }

    @Test
    fun `requires at least one operator on the left`() {
        assertFalse(accepts("12345=12"))
    }

    @Test
    fun `rejects adjacent or dangling operators`() {
        assertFalse(accepts("5++3=008"))
        assertFalse(accepts("+5+3=008"))
        assertFalse(accepts("5+3+=008"))
    }

    @Test
    fun `every rejection carries a specific reason`() {
        val junk = listOf("1+2=3", "51+21=42", "05+1=006", "12/0=120", "5++3=008", "12345=12", "0-1+10=9")
        junk.forEach {
            val r = EquationEngine.validate(it)
            assertTrue("$it should be rejected", r is ValidationResult.Invalid)
            val msg = (r as ValidationResult.Invalid).reason
            assertTrue("reason too vague for '$it': $msg", msg.length > 8)
        }
    }

    // ---- evaluation ---------------------------------------------------------

    @Test
    fun `evaluate respects order of operations`() {
        assertEquals(10L, EquationEngine.evaluate("2*3+4"))
        assertEquals(14L, EquationEngine.evaluate("2+3*4"))
        assertEquals(2L, EquationEngine.evaluate("8/4/1"))
    }

    @Test
    fun `evaluate is total and never throws`() {
        listOf("", "=", "++", "9/0", "abc", "9".repeat(40), "1+", "/2", "1+2=3")
            .forEach { EquationEngine.evaluate(it) } // must not throw
        assertNull(EquationEngine.evaluate("9/0"))
        assertNull(EquationEngine.evaluate(""))
        assertNotNull(EquationEngine.evaluate("1+1"))
    }

    // ---- commutativity ------------------------------------------------------

    @Test
    fun `addition and multiplication commute`() {
        assertTrue(EquationEngine.isCommutativelyEquivalent("12+34=46", "34+12=46"))
        assertTrue(EquationEngine.isCommutativelyEquivalent("12*9=108", "9*12=108"))
        assertTrue(EquationEngine.isCommutativelyEquivalent("1+2+3=6", "3+2+1=6"))
        assertTrue(EquationEngine.isCommutativelyEquivalent("2*3+4=10", "4+3*2=10"))
    }

    @Test
    fun `subtraction and division do not commute`() {
        assertFalse(EquationEngine.isCommutativelyEquivalent("83-13=70", "13-83=70"))
        assertFalse(EquationEngine.isCommutativelyEquivalent("100/2=50", "2/100=50"))
    }

    @Test
    fun `same value with different numbers is not equivalent`() {
        assertFalse(EquationEngine.isCommutativelyEquivalent("12+34=46", "23+23=46"))
    }

    @Test
    fun `equivalence is reflexive and symmetric over generated puzzles`() {
        val rnd = Random(20260821)
        repeat(500) {
            val a = EquationEngine.generate(rnd)
            assertTrue(EquationEngine.isCommutativelyEquivalent(a, a))
            val b = EquationEngine.generate(rnd)
            assertEquals(
                EquationEngine.isCommutativelyEquivalent(a, b),
                EquationEngine.isCommutativelyEquivalent(b, a),
            )
        }
    }

    // ---- generator ----------------------------------------------------------

    @Test
    fun `every generated puzzle passes the validator`() {
        // The anti-drift check: generator and validator must agree on every rule.
        val rnd = Random(7)
        repeat(20_000) {
            val eq = EquationEngine.generate(rnd)
            assertEquals("wrong length: $eq", EQUATION_LENGTH, eq.length)
            val v = EquationEngine.validate(eq)
            assertTrue("generator emitted an equation its own validator rejects: $eq " +
                "(${(v as? ValidationResult.Invalid)?.reason})", v is ValidationResult.Valid)
        }
    }

    @Test
    fun `generator produces a real spread of answers and operators`() {
        val rnd = Random(99)
        val puzzles = List(5_000) { EquationEngine.generate(rnd) }

        val answerLengths = puzzles.map { it.substringAfter('=').length }.toSet()
        assertEquals("answers should span 1, 2 and 3 digits", setOf(1, 2, 3), answerLengths)

        val operators = puzzles.flatMap { p -> p.substringBefore('=').filter { it in "+-*/" }.toList() }.toSet()
        assertEquals("all four operators should appear", setOf('+', '-', '*', '/'), operators)

        assertTrue("generator is too repetitive", puzzles.toSet().size > 500)
    }

    @Test
    fun `generator is deterministic for a fixed seed`() {
        val a = List(50) { EquationEngine.generate(Random(1234)) }
        val b = List(50) { EquationEngine.generate(Random(1234)) }
        assertEquals(a, b)
    }
}
