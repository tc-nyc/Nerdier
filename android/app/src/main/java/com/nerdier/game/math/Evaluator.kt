package com.nerdier.game.math

/**
 * Tokenising and arithmetic for Nerdier's eight-character equations.
 *
 * The whole domain is four operators over integers that fit comfortably in a
 * `Long`, so this is deliberately a hand-written tokenizer plus a two-pass
 * precedence evaluator — no parser generator, no arbitrary precision.
 *
 * Nothing in this file throws. Every failure comes back as a
 * human-readable [String] so [EquationEngine.validate] can show it verbatim.
 */
internal object Evaluator {

    /** Longest operand `toLong()` can take without throwing. Puzzle operands are ≤ 3 digits. */
    private const val MAX_NUMBER_DIGITS = 18

    fun isDigit(c: Char): Boolean = c in '0'..'9'

    fun isOperator(c: Char): Boolean = c == '+' || c == '-' || c == '*' || c == '/'

    fun isAllowed(c: Char): Boolean = isDigit(c) || isOperator(c) || c == '='

    /** Operands and operators of an expression, in written order. `numbers.size == ops.size + 1`. */
    class Tokens(val numbers: LongArray, val ops: CharArray)

    sealed interface TokenizeResult {
        class Success(val tokens: Tokens) : TokenizeResult
        class Failure(val reason: String) : TokenizeResult
    }

    sealed interface EvalResult {
        class Success(val value: Long) : EvalResult
        class Failure(val reason: String) : EvalResult
    }

    /**
     * Splits [expr] into operands and operators, enforcing the structural rules:
     * legal characters only, no leading/trailing operator, no adjacent operators,
     * no leading zeros on a multi-digit number.
     *
     * Returns [TokenizeResult.Success] with the tokens, or [TokenizeResult.Failure]
     * with the specific reason the text is not a well-formed expression.
     */
    fun tokenize(expr: String): TokenizeResult {
        if (expr.isEmpty()) return TokenizeResult.Failure("There's nothing to evaluate")
        for (c in expr) {
            if (!isDigit(c) && !isOperator(c)) {
                return TokenizeResult.Failure("'$c' isn't allowed in an expression")
            }
        }
        if (isOperator(expr[0])) {
            return TokenizeResult.Failure("An equation can't start with an operator")
        }
        if (isOperator(expr[expr.length - 1])) {
            return TokenizeResult.Failure("An equation can't end with an operator")
        }

        val numbers = ArrayList<Long>(4)
        val ops = ArrayList<Char>(3)
        var i = 0
        val n = expr.length
        while (i < n) {
            var j = i
            while (j < n && isDigit(expr[j])) j++
            val token = expr.substring(i, j)
            if (token.length > 1 && token[0] == '0') {
                return TokenizeResult.Failure("Numbers can't start with 0")
            }
            // Keeps toLong() total; a puzzle number is at most three digits anyway.
            if (token.length > MAX_NUMBER_DIGITS) {
                return TokenizeResult.Failure("That number is too big")
            }
            numbers.add(token.toLong())
            i = j
            if (i < n) {
                // expr[i] must be an operator: the character set was checked above.
                if (i + 1 < n && isOperator(expr[i + 1])) {
                    return TokenizeResult.Failure("Two operators in a row: '${expr[i]}${expr[i + 1]}'")
                }
                ops.add(expr[i])
                i++
            }
        }
        return TokenizeResult.Success(Tokens(numbers.toLongArray(), ops.toCharArray()))
    }

    /**
     * Evaluates already-tokenised input under standard precedence: a first pass
     * folds `*` and `/` left-to-right, a second pass folds `+` and `-` left-to-right.
     *
     * Returns [EvalResult.Success] with the value, or [EvalResult.Failure] when the
     * arithmetic breaks a puzzle rule — division by zero, inexact division, or a
     * negative running total (intermediate results may not go below zero).
     */
    fun evalTokens(tokens: Tokens): EvalResult {
        val numbers = tokens.numbers
        val ops = tokens.ops

        // Pass 1 — multiplicative folding into additive terms.
        val terms = ArrayList<Long>(numbers.size)
        val addOps = ArrayList<Char>(numbers.size)
        terms.add(numbers[0])
        for (idx in ops.indices) {
            val next = numbers[idx + 1]
            when (ops[idx]) {
                '*' -> {
                    val left = terms[terms.size - 1]
                    val product = left * next
                    // Puzzle values are tiny; this only fires on out-of-domain input.
                    if (left != 0L && product / left != next) {
                        return EvalResult.Failure("That gets too big to work out")
                    }
                    terms[terms.size - 1] = product
                }
                '/' -> {
                    val left = terms[terms.size - 1]
                    if (next == 0L) return EvalResult.Failure("Can't divide by zero")
                    if (left % next != 0L) {
                        return EvalResult.Failure("$left/$next isn't a whole number")
                    }
                    terms[terms.size - 1] = left / next
                }
                else -> {
                    addOps.add(ops[idx])
                    terms.add(next)
                }
            }
        }

        // Pass 2 — additive folding, rejecting any negative intermediate.
        var total = terms[0]
        for (idx in addOps.indices) {
            val term = terms[idx + 1]
            if (addOps[idx] == '+') {
                val sum = total + term
                if (sum < total) return EvalResult.Failure("That gets too big to work out")
                total = sum
            } else {
                if (total - term < 0L) {
                    return EvalResult.Failure("$total-$term goes negative — no negative numbers")
                }
                total -= term
            }
        }
        return EvalResult.Success(total)
    }

    /** Tokenises then evaluates [expr]; the reason on failure is the first rule it breaks. */
    fun evalDetailed(expr: String): EvalResult =
        when (val t = tokenize(expr)) {
            is TokenizeResult.Failure -> EvalResult.Failure(t.reason)
            is TokenizeResult.Success -> evalTokens(t.tokens)
        }

    // ------------------------------------------------------------------ tree

    /** Parse tree node: either a literal operand or an operator applied to its children. */
    sealed class ExprNode {
        class Num(val value: Long) : ExprNode()
        class Op(val op: Char, val kids: List<ExprNode>) : ExprNode()
    }

    private fun kidsOf(node: ExprNode, op: Char): List<ExprNode> =
        if (node is ExprNode.Op && node.op == op) node.kids else listOf(node)

    /** Folds [left] and [right] into one node for the associative-commutative [op], flattening chains. */
    private fun merge(op: Char, left: ExprNode, right: ExprNode): ExprNode =
        ExprNode.Op(op, kidsOf(left, op) + kidsOf(right, op))

    /**
     * Builds the precedence-correct, left-associative parse tree for [tokens].
     * Chains of the same commutative operator (`+`, `*`) are flattened into one
     * n-ary node so that `1+2+3` and `3+2+1` land on the same shape;
     * `-` and `/` stay strictly binary and ordered.
     */
    fun buildTree(tokens: Tokens): ExprNode {
        val numbers = tokens.numbers
        val ops = tokens.ops
        val terms = ArrayList<ExprNode>(numbers.size)
        val addOps = ArrayList<Char>(numbers.size)
        terms.add(ExprNode.Num(numbers[0]))
        for (idx in ops.indices) {
            val next = ExprNode.Num(numbers[idx + 1])
            when (ops[idx]) {
                '*' -> terms[terms.size - 1] = merge('*', terms[terms.size - 1], next)
                '/' -> terms[terms.size - 1] = ExprNode.Op('/', listOf(terms[terms.size - 1], next))
                else -> {
                    addOps.add(ops[idx])
                    terms.add(next)
                }
            }
        }
        var node = terms[0]
        for (idx in addOps.indices) {
            node = if (addOps[idx] == '+') {
                merge('+', node, terms[idx + 1])
            } else {
                ExprNode.Op('-', listOf(node, terms[idx + 1]))
            }
        }
        return node
    }

    /**
     * Renders [node] as a canonical string: operands of `+` and `*` are sorted, so
     * two trees render identically exactly when they differ only by commutative
     * reordering. Returns e.g. `+(4,*(2,3))` for both `2*3+4` and `4+3*2`.
     */
    fun render(node: ExprNode): String = when (node) {
        is ExprNode.Num -> node.value.toString()
        is ExprNode.Op -> {
            val parts = node.kids.map { render(it) }
            val ordered = if (node.op == '+' || node.op == '*') parts.sorted() else parts
            ordered.joinToString(separator = ",", prefix = "${node.op}(", postfix = ")")
        }
    }
}
