package com.nerdier.game.math

import com.nerdier.game.model.ValidationResult
import kotlin.random.Random

/**
 * Builds random puzzle equations.
 *
 * Strategy: pick a *shape* (how many digits each left-hand operand has, and how
 * many digits the answer must have), fill it with random digits and operators,
 * evaluate, and keep it only if the answer lands on the required number of
 * digits and [EquationEngine.validate] accepts the finished string. Because the
 * accept test is the real validator, the generator cannot drift from the rules.
 *
 * Termination: at most [MAX_ATTEMPTS] draws, then a known-good fallback.
 */
internal object Generator {

    /**
     * [digits] gives the digit count of each left-hand operand in order, so its
     * size minus one is the operator count; [rhsDigits] is the required answer
     * length. [weight] is the relative chance of drawing this shape — tuned so
     * that 1-, 2- and 3-digit answers come out roughly equally often even though
     * the shapes have wildly different hit rates.
     */
    private class Shape(val digits: IntArray, val rhsDigits: Int, val weight: Int)

    /**
     * All structurally possible shapes on eight tiles.
     *
     * With `L` left-hand characters, `k` operators need `k + 1` operands, so
     * `2k + 1 <= L <= 6`: **an eight-tile equation can never hold more than two
     * operators on the left**, and no left-hand operand can exceed three digits.
     * Two further shapes — operands of 2 then 3 digits with a 1-digit answer, and
     * 1 then 3 digits with a 2-digit answer — are omitted because exhaustive
     * search shows no equation of either shape can satisfy the rules.
     */
    private val SHAPES = listOf(
        Shape(intArrayOf(3, 2), 1, 148),      // e.g. 126/14=9   (needs cancellation; rare)
        Shape(intArrayOf(1, 1, 2), 1, 15),    // e.g. 9*8-64=8
        Shape(intArrayOf(1, 2, 1), 1, 16),    // e.g. 48/6-3=5
        Shape(intArrayOf(2, 1, 1), 1, 18),    // e.g. 12/4+6=9
        Shape(intArrayOf(2, 2), 2, 7),        // e.g. 10+25=35
        Shape(intArrayOf(3, 1), 2, 27),       // e.g. 126/9=14
        Shape(intArrayOf(1, 1, 1), 2, 6),     // e.g. 5*4-8=12
        Shape(intArrayOf(1, 2), 3, 9),        // e.g. 9*45=405
        Shape(intArrayOf(2, 1), 3, 9),        // e.g. 23*8=184
    )

    private val TOTAL_WEIGHT = SHAPES.sumOf { it.weight }

    /** Draws needed per success average around 26; the cap is pure insurance. */
    private const val MAX_ATTEMPTS = 4000

    /** Hand-checked valid equations covering every answer length and operator. */
    private val FALLBACKS = listOf(
        "9*8-64=8", "48/6-3=5", "12/4+6=9", "126/14=9",
        "5*4-8=12", "9+8*2=25", "10+25=35", "72-14=58", "126/9=14",
        "9*45=405", "23*8=184", "9+99=108",
    )

    private val OP_CHARS = charArrayOf('+', '-', '*', '/')

    /** A valid eight-character equation; never loops forever and never returns junk. */
    fun generate(random: Random): String {
        repeat(MAX_ATTEMPTS) {
            val candidate = attempt(pickShape(random), random)
            if (candidate != null) return candidate
        }
        return FALLBACKS[random.nextInt(FALLBACKS.size)]
    }

    private fun pickShape(random: Random): Shape {
        var r = random.nextInt(TOTAL_WEIGHT)
        for (shape in SHAPES) {
            r -= shape.weight
            if (r < 0) return shape
        }
        return SHAPES[SHAPES.size - 1]
    }

    /** One random draw for [shape]; null when the draw breaks a rule or misses the answer length. */
    private fun attempt(shape: Shape, random: Random): String? {
        val count = shape.digits.size
        val numbers = LongArray(count) { randomNumber(shape.digits[it], random) }
        val ops = CharArray(count - 1) { OP_CHARS[random.nextInt(OP_CHARS.size)] }

        val value = when (val r = Evaluator.evalTokens(Evaluator.Tokens(numbers, ops))) {
            is Evaluator.EvalResult.Failure -> return null
            is Evaluator.EvalResult.Success -> r.value
        }
        val answer = value.toString()
        if (answer.length != shape.rhsDigits) return null

        val sb = StringBuilder(8)
        sb.append(numbers[0])
        for (i in ops.indices) {
            sb.append(ops[i]).append(numbers[i + 1])
        }
        sb.append('=').append(answer)
        val candidate = sb.toString()

        // Belt and braces: the shipped validator has the final say.
        return if (EquationEngine.validate(candidate) is ValidationResult.Valid) candidate else null
    }

    /** A non-negative integer with exactly [digits] digits and no leading zero. */
    private fun randomNumber(digits: Int, random: Random): Long {
        if (digits == 1) return random.nextInt(10).toLong()
        var v = (random.nextInt(9) + 1).toLong()
        repeat(digits - 1) { v = v * 10 + random.nextInt(10) }
        return v
    }
}
