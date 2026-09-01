package com.nerdier.game.math

import com.nerdier.game.model.EQUATION_LENGTH
import com.nerdier.game.model.ValidationResult
import kotlin.random.Random

/**
 * The mathematics of Nerdier: puzzle generation, guess validation, expression
 * evaluation and commutative equivalence. Pure Kotlin — no Android imports.
 *
 * ## The rules, enforced identically here and in [Generator]
 * 1. Exactly [EQUATION_LENGTH] characters drawn from `0-9 + - * / =`, one `=`.
 * 2. Operators appear only left of the `=`; the right-hand side is a bare
 *    non-negative integer of one, two or three digits.
 * 3. Standard precedence: `*` and `/` bind tighter than `+` and `-`,
 *    left-to-right within a precedence level.
 * 4. Integer arithmetic only. Division must be exact and never by zero.
 * 5. No negative value anywhere, including intermediate results — `3-5+4`
 *    is illegal even though it ends positive.
 * 6. No leading zeros on a multi-digit number; a bare `0` is a legal operand.
 * 7. The left-hand side contains at least one operator.
 * 8. No adjacent operators, and no operator at either end.
 */
object EquationEngine {

    private const val MAX_RHS_DIGITS = 3

    /**
     * Returns a fresh valid eight-character puzzle equation.
     *
     * Answer lengths are spread roughly evenly across one, two and three digits,
     * with a mix of operator counts (one or two — three is impossible on eight
     * tiles) and all four operators represented. Always terminates: the search is
     * capped and falls back to a known-good equation rather than looping.
     */
    fun generate(random: Random = Random.Default): String = Generator.generate(random)

    /**
     * Returns [ValidationResult.Valid] if [guess] is a legal Nerdier equation, or
     * [ValidationResult.Invalid] whose `reason` names the specific rule broken —
     * e.g. `"Needs exactly one = sign"`, `"7/2 isn't a whole number"`,
     * `"51+21=42 — the left side equals 72"`. The reason is shown to the player
     * verbatim, so it is always concrete.
     */
    fun validate(guess: String): ValidationResult {
        val n = guess.length
        if (n != EQUATION_LENGTH) {
            return invalid(
                if (n < EQUATION_LENGTH) "That's only $n characters — equations are exactly 8"
                else "That's $n characters — equations are exactly 8"
            )
        }
        for (c in guess) {
            if (!Evaluator.isAllowed(c)) {
                return invalid("'$c' isn't allowed — use digits, + - * / and =")
            }
        }

        var equalsCount = 0
        for (c in guess) if (c == '=') equalsCount++
        if (equalsCount == 0) return invalid("Needs exactly one = sign")
        if (equalsCount > 1) return invalid("Only one = sign allowed")

        val idx = guess.indexOf('=')
        val lhs = guess.substring(0, idx)
        val rhs = guess.substring(idx + 1)

        if (lhs.isEmpty()) return invalid("There's nothing to the left of the =")
        if (rhs.isEmpty()) return invalid("There's nothing to the right of the =")

        for (c in rhs) {
            if (Evaluator.isOperator(c)) return invalid("Operators belong on the left of the =")
        }
        if (rhs.length > MAX_RHS_DIGITS) return invalid("The answer can be at most 3 digits")
        if (rhs.length > 1 && rhs[0] == '0') return invalid("Numbers can't start with 0")

        if (lhs.none { Evaluator.isOperator(it) }) {
            return invalid("The left side needs at least one operator")
        }

        val tokens = when (val t = Evaluator.tokenize(lhs)) {
            is Evaluator.TokenizeResult.Failure -> return invalid(t.reason)
            is Evaluator.TokenizeResult.Success -> t.tokens
        }
        val value = when (val e = Evaluator.evalTokens(tokens)) {
            is Evaluator.EvalResult.Failure -> return invalid(e.reason)
            is Evaluator.EvalResult.Success -> e.value
        }

        val answer = rhs.toLong()
        if (value != answer) return invalid("$guess — the left side equals $value")
        return ValidationResult.Valid
    }

    /**
     * Returns the value of [expression] — a left-hand side only, no `=` — under
     * the puzzle's arithmetic, or `null` when it cannot be evaluated: illegal
     * characters, malformed operator placement, a leading zero, division by zero,
     * inexact division, or a negative intermediate result. Never throws.
     *
     * A bare number evaluates to itself; the "needs an operator" rule is a puzzle
     * rule enforced by [validate], not an arithmetic one.
     */
    fun evaluate(expression: String): Long? =
        when (val r = Evaluator.evalDetailed(expression)) {
            is Evaluator.EvalResult.Success -> r.value
            is Evaluator.EvalResult.Failure -> null
        }

    /**
     * Returns true when [a] and [b] are the same equation up to reordering the
     * operands of commutative operators.
     *
     * **Semantics.** Each side is parsed into its precedence-correct,
     * left-associative tree. Runs of `+` and runs of `*` are flattened into n-ary
     * nodes whose operands are then sorted, because addition and multiplication
     * are both commutative *and* associative: `5+3=8` ≡ `3+5=8`, `4*2=8` ≡ `2*4=8`,
     * `1+2+3=6` ≡ `3+2+1=6`, and — since the flattening respects precedence —
     * `2*3+4=10` ≡ `4+3*2=10`.
     *
     * `-` and `/` are neither commutative nor associative, so they stay strictly
     * binary and ordered, and nothing is reordered across them: `8-3=5` is not
     * equivalent to `3-8=5`, and `3+5-2=6` is not equivalent to `5-2+3=6` even
     * though both are valid and equal. Reordering only ever happens inside a
     * single commutative node — this is deliberately structural equivalence, not
     * numeric equality, so `4+4=8` and `5+3=8` are not equivalent either.
     *
     * Returns false unless both sides are well-formed, arithmetically legal
     * equations. That check is the arithmetic half of [validate] — one `=`, an
     * evaluable left side, a bare non-negative integer on the right that the left
     * side really equals — but not the eight-tile length or the three-digit answer
     * cap, so short illustrations like `5+3=8` ≡ `3+5=8` behave as documented.
     */
    fun isCommutativelyEquivalent(a: String, b: String): Boolean {
        val ca = canonicalize(a) ?: return false
        val cb = canonicalize(b) ?: return false
        return ca == cb
    }

    /** Canonical form of a well-formed equation, or null if it is not one. */
    private fun canonicalize(equation: String): String? {
        var equalsCount = 0
        for (c in equation) if (c == '=') equalsCount++
        if (equalsCount != 1) return null

        val idx = equation.indexOf('=')
        val rhs = equation.substring(idx + 1)
        if (rhs.isEmpty() || rhs.length > 18) return null
        if (rhs.any { !Evaluator.isDigit(it) }) return null
        if (rhs.length > 1 && rhs[0] == '0') return null

        val tokens = when (val t = Evaluator.tokenize(equation.substring(0, idx))) {
            is Evaluator.TokenizeResult.Failure -> return null
            is Evaluator.TokenizeResult.Success -> t.tokens
        }
        val value = when (val e = Evaluator.evalTokens(tokens)) {
            is Evaluator.EvalResult.Failure -> return null
            is Evaluator.EvalResult.Success -> e.value
        }
        if (value != rhs.toLong()) return null
        return Evaluator.render(Evaluator.buildTree(tokens)) + "=" + value
    }

    private fun invalid(reason: String): ValidationResult = ValidationResult.Invalid(reason)
}
