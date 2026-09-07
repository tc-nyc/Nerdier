/**
 * The mathematics of Nerdier: puzzle generation, guess validation, expression
 * evaluation and commutative equivalence.
 *
 * Ported one-for-one from the Android build's `math/Evaluator.kt`,
 * `math/Generator.kt` and `math/EquationEngine.kt`. Same rules, same shape
 * table and weights, same failure wording, same canonicalisation. Pure
 * TypeScript — no DOM, no React, no dependencies.
 *
 * ## The rules, enforced identically by the generator and the validator
 * 1. Exactly {@link EQUATION_LENGTH} characters drawn from `0-9 + - * / =`, one `=`.
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
 * 9. No multiplication may have zero as an operand — `0*7`, `7*0` and any
 *    `*0`/`0*` inside a longer expression are illegal.
 * 10. No division may have zero as its dividend — `0/1234` is illegal, as is
 *    any division whose left operand works out to zero, such as the second
 *    `/` of `0/6/2`. Dividing *by* zero was already illegal and keeps its own
 *    more specific message.
 *
 * Rules 9 and 10 are both read by operand **value**, not by written character,
 * and both are deliberately narrow: zero is still a fine operand elsewhere, so
 * `0+5`, `5-0` and `10-0-4` stay legal, and a `0` that is merely a digit of a
 * longer number (the `40` of `9*40`) was never in scope.
 *
 * Nothing in this file throws. Every failure comes back as a value.
 */

import { EQUATION_LENGTH } from './types'
import type { ValidationResult } from './types'

// ---------------------------------------------------------------- characters

/** True when [c] is a single decimal digit. */
function isDigit(c: string): boolean {
  return c.length === 1 && c >= '0' && c <= '9'
}

/** True when [c] is one of the four puzzle operators. */
function isOperator(c: string): boolean {
  return c === '+' || c === '-' || c === '*' || c === '/'
}

/** True when [c] may appear anywhere in an equation. */
function isAllowed(c: string): boolean {
  return isDigit(c) || isOperator(c) || c === '='
}

/**
 * Longest operand we will parse. The Kotlin used 18 because operands lived in a
 * `Long`; JavaScript numbers are doubles, so 15 digits is the widest that is
 * always exactly representable. Puzzle operands are at most three digits, so
 * this bound only ever fires on out-of-domain input.
 */
const MAX_NUMBER_DIGITS = 15

/** Answers are one, two or three digits — never more. */
const MAX_RHS_DIGITS = 3

// -------------------------------------------------------------- tokenisation

/** Operands and operators of an expression, in written order: `numbers.length === ops.length + 1`. */
interface Tokens {
  readonly numbers: readonly number[]
  readonly ops: readonly string[]
}

type TokenizeResult = { readonly ok: true; readonly tokens: Tokens } | { readonly ok: false; readonly reason: string }

type EvalResult = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly reason: string }

function evalFailure(reason: string): EvalResult {
  return { ok: false, reason }
}

/**
 * Returns the operands and operators of [expr], or the specific reason it is not
 * a well-formed expression: illegal characters, a leading or trailing operator,
 * two operators in a row, a leading zero, or an absurdly long number.
 */
function tokenize(expr: string): TokenizeResult {
  const n = expr.length
  if (n === 0) return { ok: false, reason: "There's nothing to evaluate" }

  for (let i = 0; i < n; i++) {
    const c = expr.charAt(i)
    if (!isDigit(c) && !isOperator(c)) {
      return { ok: false, reason: `'${c}' isn't allowed in an expression` }
    }
  }
  if (isOperator(expr.charAt(0))) {
    return { ok: false, reason: "An equation can't start with an operator" }
  }
  if (isOperator(expr.charAt(n - 1))) {
    return { ok: false, reason: "An equation can't end with an operator" }
  }

  const numbers: number[] = []
  const ops: string[] = []
  let i = 0
  while (i < n) {
    let j = i
    while (j < n && isDigit(expr.charAt(j))) j++
    const token = expr.slice(i, j)
    // Non-empty by construction: the string neither starts with an operator nor
    // holds two in a row, and it does not end with one.
    if (token.length === 0) return { ok: false, reason: 'That expression is malformed' }
    if (token.length > 1 && token.charAt(0) === '0') {
      return { ok: false, reason: "Numbers can't start with 0" }
    }
    if (token.length > MAX_NUMBER_DIGITS) {
      return { ok: false, reason: 'That number is too big' }
    }
    numbers.push(Number(token))
    i = j
    if (i < n) {
      // expr[i] must be an operator: the character set was checked above.
      if (i + 1 < n && isOperator(expr.charAt(i + 1))) {
        return { ok: false, reason: `Two operators in a row: '${expr.charAt(i)}${expr.charAt(i + 1)}'` }
      }
      ops.push(expr.charAt(i))
      i++
    }
  }
  return { ok: true, tokens: { numbers, ops } }
}

// ---------------------------------------------------------------- arithmetic

/**
 * Returns the value of already-tokenised input under standard precedence — a
 * first pass folds `*` and `/` left-to-right, a second folds `+` and `-` — or
 * the reason the arithmetic breaks a puzzle rule: division by zero, inexact
 * division, or a negative running total.
 */
function evalTokens(tokens: Tokens): EvalResult {
  const { numbers, ops } = tokens
  const first = numbers[0]
  if (first === undefined) return evalFailure("There's nothing to evaluate")

  // Pass 1 — multiplicative folding into additive terms.
  const terms: number[] = [first]
  const addOps: string[] = []
  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx]
    const next = numbers[idx + 1]
    if (op === undefined || next === undefined) return evalFailure('That expression is malformed')
    const lastIdx = terms.length - 1
    const left = terms[lastIdx]
    if (left === undefined) return evalFailure('That expression is malformed')

    if (op === '*') {
      const product = left * next
      // Puzzle values are tiny; this only fires on out-of-domain input.
      if (!Number.isSafeInteger(product)) return evalFailure('That gets too big to work out')
      terms[lastIdx] = product
    } else if (op === '/') {
      if (next === 0) return evalFailure("Can't divide by zero")
      if (left % next !== 0) return evalFailure(`${left}/${next} isn't a whole number`)
      terms[lastIdx] = left / next
    } else {
      addOps.push(op)
      terms.push(next)
    }
  }

  // Pass 2 — additive folding, rejecting any negative intermediate.
  const start = terms[0]
  if (start === undefined) return evalFailure('That expression is malformed')
  let total = start
  for (let idx = 0; idx < addOps.length; idx++) {
    const op = addOps[idx]
    const term = terms[idx + 1]
    if (op === undefined || term === undefined) return evalFailure('That expression is malformed')
    if (op === '+') {
      const sum = total + term
      if (!Number.isSafeInteger(sum)) return evalFailure('That gets too big to work out')
      total = sum
    } else {
      if (total - term < 0) {
        return evalFailure(`${total}-${term} goes negative — no negative numbers`)
      }
      total -= term
    }
  }
  return { ok: true, value: total }
}

/**
 * True when any multiplication in [tokens] has zero as an operand — `0*7`, `7*0`,
 * the `92*0` inside `4+92*0`, and also a zero arrived at by an earlier step of
 * the same term, as in `0/1*10`. Operands are compared by value, so a written
 * `0` that is merely part of a longer number (the `10` of `10*2`) is untouched.
 *
 * This is a puzzle rule, not an arithmetic one: it is enforced by
 * {@link validateEquation}, while {@link evaluateExpression} still works `0*7`
 * out to 0. The scan mirrors the multiplicative pass of {@link evalTokens} and
 * gives up quietly — returning false — on input that pass would reject anyway
 * (division by zero, inexact division, out-of-range products), so those keep
 * their own more specific messages.
 */
function multipliesByZero(tokens: Tokens): boolean {
  const { numbers, ops } = tokens
  const first = numbers[0]
  if (first === undefined) return false
  let term: number = first

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx]
    const next = numbers[idx + 1]
    if (op === undefined || next === undefined) return false

    if (op === '*') {
      if (term === 0 || next === 0) return true
      const product = term * next
      if (!Number.isSafeInteger(product)) return false
      term = product
    } else if (op === '/') {
      if (next === 0 || term % next !== 0) return false
      term = term / next
    } else {
      // `+` and `-` start a fresh multiplicative term; nothing carries across.
      term = next
    }
  }
  return false
}

/**
 * True when any division in [tokens] has zero as its dividend — the `0/1234` of
 * `0/1234=0`, the second `/` of `0/6/2` where the zero is arrived at rather than
 * written, and a zero that reaches a division through an earlier `+` or `-` term
 * boundary, as in `5-5+0/8`. Operands are compared by value, so a written `0`
 * that is merely part of a longer number (the `10` of `10/2`) is untouched.
 *
 * Dividing **by** zero is a different, older rule: this scan returns false the
 * moment it meets a zero divisor — including for `0/0` — so that
 * {@link evalTokens} can reject it with the more specific "Can't divide by zero".
 *
 * Like {@link multipliesByZero} this is a puzzle rule rather than an arithmetic
 * one: {@link evaluateExpression} still works `0/6` out to 0, and the scan gives
 * up quietly on input {@link evalTokens} would reject anyway, so those keep their
 * own messages.
 */
function dividesZero(tokens: Tokens): boolean {
  const { numbers, ops } = tokens
  const first = numbers[0]
  if (first === undefined) return false
  let term: number = first

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx]
    const next = numbers[idx + 1]
    if (op === undefined || next === undefined) return false

    if (op === '/') {
      // Divisor first: a zero divisor is somebody else's, more specific, error.
      if (next === 0) return false
      if (term === 0) return true
      if (term % next !== 0) return false
      term = term / next
    } else if (op === '*') {
      const product = term * next
      if (!Number.isSafeInteger(product)) return false
      term = product
    } else {
      // `+` and `-` start a fresh multiplicative term; nothing carries across.
      term = next
    }
  }
  return false
}

/** Tokenises then evaluates [expr]; the reason on failure is the first rule it breaks. */
function evalDetailed(expr: string): EvalResult {
  const t = tokenize(expr)
  if (!t.ok) return evalFailure(t.reason)
  return evalTokens(t.tokens)
}

// --------------------------------------------------------------- parse trees

/** Parse tree node: either a literal operand or an operator applied to its children. */
type ExprNode =
  | { readonly kind: 'num'; readonly value: number }
  | { readonly kind: 'op'; readonly op: string; readonly kids: readonly ExprNode[] }

function kidsOf(node: ExprNode, op: string): readonly ExprNode[] {
  return node.kind === 'op' && node.op === op ? node.kids : [node]
}

/** Folds [left] and [right] into one node for the associative-commutative [op], flattening chains. */
function merge(op: string, left: ExprNode, right: ExprNode): ExprNode {
  return { kind: 'op', op, kids: [...kidsOf(left, op), ...kidsOf(right, op)] }
}

/**
 * Returns the precedence-correct, left-associative parse tree for [tokens].
 * Chains of the same commutative operator (`+`, `*`) are flattened into one
 * n-ary node so that `1+2+3` and `3+2+1` land on the same shape; `-` and `/`
 * stay strictly binary and ordered.
 */
function buildTree(tokens: Tokens): ExprNode | null {
  const { numbers, ops } = tokens
  const first = numbers[0]
  if (first === undefined) return null

  const terms: ExprNode[] = [{ kind: 'num', value: first }]
  const addOps: string[] = []
  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx]
    const value = numbers[idx + 1]
    if (op === undefined || value === undefined) return null
    const next: ExprNode = { kind: 'num', value }
    const lastIdx = terms.length - 1
    const left = terms[lastIdx]
    if (left === undefined) return null

    if (op === '*') {
      terms[lastIdx] = merge('*', left, next)
    } else if (op === '/') {
      terms[lastIdx] = { kind: 'op', op: '/', kids: [left, next] }
    } else {
      addOps.push(op)
      terms.push(next)
    }
  }

  let node = terms[0]
  if (node === undefined) return null
  for (let idx = 0; idx < addOps.length; idx++) {
    const op = addOps[idx]
    const term = terms[idx + 1]
    if (op === undefined || term === undefined) return null
    node = op === '+' ? merge('+', node, term) : { kind: 'op', op: '-', kids: [node, term] }
  }
  return node
}

/**
 * Returns [node] as a canonical string: operands of `+` and `*` are sorted, so
 * two trees render identically exactly when they differ only by commutative
 * reordering. Renders e.g. `+(4,*(2,3))` for both `2*3+4` and `4+3*2`.
 */
function render(node: ExprNode): string {
  if (node.kind === 'num') return String(node.value)
  const parts = node.kids.map(render)
  // Kotlin's List<String>.sorted() and JS's default sort both order by UTF-16
  // code unit, so the two implementations produce byte-identical canonical forms.
  const ordered = node.op === '+' || node.op === '*' ? [...parts].sort() : parts
  return `${node.op}(${ordered.join(',')})`
}

// ---------------------------------------------------------------- public API

/**
 * Returns `{ ok: true }` if [guess] is a legal Nerdier equation, or
 * `{ ok: false, reason }` whose reason names the specific rule broken — e.g.
 * `"Needs exactly one = sign"`, `"7/2 isn't a whole number"`,
 * `"No multiplying by zero"`, `"No dividing zero"`,
 * `"51+21=42 — the left side equals 72"`. The reason is shown to the player
 * verbatim, so it is always concrete.
 */
export function validateEquation(guess: string): ValidationResult {
  const n = guess.length
  if (n !== EQUATION_LENGTH) {
    return invalid(
      n < EQUATION_LENGTH
        ? `That's only ${n} characters — equations are exactly 8`
        : `That's ${n} characters — equations are exactly 8`,
    )
  }
  for (let i = 0; i < n; i++) {
    const c = guess.charAt(i)
    if (!isAllowed(c)) {
      return invalid(`'${c}' isn't allowed — use digits, + - * / and =`)
    }
  }

  let equalsCount = 0
  for (let i = 0; i < n; i++) if (guess.charAt(i) === '=') equalsCount++
  if (equalsCount === 0) return invalid('Needs exactly one = sign')
  if (equalsCount > 1) return invalid('Only one = sign allowed')

  const idx = guess.indexOf('=')
  const lhs = guess.slice(0, idx)
  const rhs = guess.slice(idx + 1)

  if (lhs.length === 0) return invalid("There's nothing to the left of the =")
  if (rhs.length === 0) return invalid("There's nothing to the right of the =")

  for (let i = 0; i < rhs.length; i++) {
    if (isOperator(rhs.charAt(i))) return invalid('Operators belong on the left of the =')
  }
  if (rhs.length > MAX_RHS_DIGITS) return invalid('The answer can be at most 3 digits')
  if (rhs.length > 1 && rhs.charAt(0) === '0') return invalid("Numbers can't start with 0")

  let lhsHasOperator = false
  for (let i = 0; i < lhs.length; i++) if (isOperator(lhs.charAt(i))) lhsHasOperator = true
  if (!lhsHasOperator) return invalid('The left side needs at least one operator')

  const t = tokenize(lhs)
  if (!t.ok) return invalid(t.reason)
  // Order matters only for the doubly-illegal `0/1*10=0`, where the zero
  // reaches a `*`: multiplication is reported there, as it was before this rule.
  if (multipliesByZero(t.tokens)) return invalid('No multiplying by zero')
  if (dividesZero(t.tokens)) return invalid('No dividing zero')
  const e = evalTokens(t.tokens)
  if (!e.ok) return invalid(e.reason)

  const answer = Number(rhs)
  if (e.value !== answer) return invalid(`${guess} — the left side equals ${e.value}`)
  return { ok: true }
}

/**
 * Returns the value of [expr] — a left-hand side only, no `=` — under the
 * puzzle's arithmetic, or `null` when it cannot be evaluated: illegal
 * characters, malformed operator placement, a leading zero, division by zero,
 * inexact division, or a negative intermediate result. Never throws.
 *
 * A bare number evaluates to itself. The "needs an operator", "no multiplying
 * by zero" and "no dividing zero" rules are puzzle rules enforced by
 * {@link validateEquation}, not arithmetic ones, so `0*7` and `0/6` both still
 * evaluate to 0.
 */
export function evaluateExpression(expr: string): number | null {
  const r = evalDetailed(expr)
  return r.ok ? r.value : null
}

/**
 * Returns true when [a] and [b] are the same equation up to reordering the
 * operands of commutative operators.
 *
 * **Semantics.** Each side is parsed into its precedence-correct,
 * left-associative tree. Runs of `+` and runs of `*` are flattened into n-ary
 * nodes whose operands are then sorted, because addition and multiplication are
 * both commutative *and* associative: `5+3=8` ≡ `3+5=8`, `4*2=8` ≡ `2*4=8`,
 * `1+2+3=6` ≡ `3+2+1=6`, and — since the flattening respects precedence —
 * `2*3+4=10` ≡ `4+3*2=10`.
 *
 * `-` and `/` are neither commutative nor associative, so they stay strictly
 * binary and ordered, and nothing is reordered across them: `8-3=5` is not
 * equivalent to `3-8=5`, and `3+5-2=6` is not equivalent to `5-2+3=6` even
 * though both are valid and equal. Reordering only ever happens inside a single
 * commutative node — this is deliberately structural equivalence, not numeric
 * equality, so `4+4=8` and `5+3=8` are not equivalent either.
 *
 * Returns false unless both sides are well-formed, arithmetically legal
 * equations. That check is the arithmetic half of {@link validateEquation} — one
 * `=`, an evaluable left side, a bare non-negative integer on the right that the
 * left side really equals — but not the eight-tile length or the three-digit
 * answer cap, so short illustrations like `5+3=8` ≡ `3+5=8` behave as documented.
 */
export function isCommutativelyEquivalent(a: string, b: string): boolean {
  const ca = canonicalize(a)
  if (ca === null) return false
  const cb = canonicalize(b)
  if (cb === null) return false
  return ca === cb
}

/** Canonical form of a well-formed equation, or null if it is not one. */
function canonicalize(equation: string): string | null {
  let equalsCount = 0
  for (let i = 0; i < equation.length; i++) if (equation.charAt(i) === '=') equalsCount++
  if (equalsCount !== 1) return null

  const idx = equation.indexOf('=')
  const rhs = equation.slice(idx + 1)
  if (rhs.length === 0 || rhs.length > MAX_NUMBER_DIGITS) return null
  for (let i = 0; i < rhs.length; i++) if (!isDigit(rhs.charAt(i))) return null
  if (rhs.length > 1 && rhs.charAt(0) === '0') return null

  const t = tokenize(equation.slice(0, idx))
  if (!t.ok) return null
  const e = evalTokens(t.tokens)
  if (!e.ok) return null
  if (e.value !== Number(rhs)) return null

  const tree = buildTree(t.tokens)
  if (tree === null) return null
  return `${render(tree)}=${e.value}`
}

function invalid(reason: string): ValidationResult {
  return { ok: false, reason }
}

// ----------------------------------------------------------------- generator

/**
 * The digit count of each left-hand operand in order — so `digits.length - 1` is
 * the operator count — the required answer length, and the relative chance of
 * drawing this shape. Weights compensate for the shapes' wildly different hit
 * rates: they were tuned for a roughly even split of 1-, 2- and 3-digit answers,
 * but both zero rules fell almost entirely on the one-digit-answer shapes, so
 * the observed split has drifted from 33 / 33 / 33 to 17 / 41 / 41 (after
 * no-multiplying-by-zero) and now to about 12 / 44 / 44. Every shape below still
 * has solutions; retuning the weights is a game-design call, not a correctness
 * one, so the numbers are left as they were.
 */
interface Shape {
  readonly digits: readonly number[]
  readonly rhsDigits: number
  readonly weight: number
}

/**
 * All structurally possible shapes on eight tiles.
 *
 * With `L` left-hand characters, `k` operators need `k + 1` operands, so
 * `2k + 1 <= L <= 6`: an eight-tile equation can never hold more than two
 * operators on the left. That leaves thirteen candidate shapes, four of which
 * exhaustive search shows are empty and which are therefore omitted here:
 * 2 then 3 digits with a 1-digit answer, 1 then 3 digits with a 2-digit answer,
 * and both four-digit shapes — `NNNN op N` emptied by the no-multiplying-by-zero
 * rule (only `1234*0=0` forms had ever qualified) and `N op NNNN` emptied by the
 * no-dividing-zero rule (its 9,000 survivors were all `0/1234=0`, which was
 * exactly the 27% of the space the principal wanted gone). So it is now true,
 * rather than merely convenient, that no left-hand operand exceeds three digits.
 *
 * Solution counts per shape, under both zero rules, are noted below and total
 * 17,960 — exhaustive enumeration of the whole eight-tile space, down from
 * 31,370 before the no-dividing-zero rule and 65,374 before either. None of the
 * nine shapes the generator draws from is empty.
 */
const SHAPES: readonly Shape[] = [
  { digits: [3, 2], rhsDigits: 1, weight: 148 }, // 659 solutions (unchanged); e.g. 126/14=9 (needs cancellation; rare)
  { digits: [1, 1, 2], rhsDigits: 1, weight: 15 }, // 783 solutions (was 3393); e.g. 9*8-64=8
  { digits: [1, 2, 1], rhsDigits: 1, weight: 16 }, // 813 solutions (was 2613); e.g. 48/6-3=5
  { digits: [2, 1, 1], rhsDigits: 1, weight: 18 }, // 3496 solutions (unchanged); e.g. 12/4+6=9
  { digits: [2, 2], rhsDigits: 2, weight: 7 }, // 6480 solutions (unchanged); e.g. 10+25=35
  { digits: [3, 1], rhsDigits: 2, weight: 27 }, // 659 solutions (unchanged); e.g. 126/9=14
  { digits: [1, 1, 1], rhsDigits: 2, weight: 6 }, // 3752 solutions (unchanged); e.g. 5*4-8=12
  { digits: [1, 2], rhsDigits: 3, weight: 9 }, // 659 solutions (unchanged); e.g. 9*45=405
  { digits: [2, 1], rhsDigits: 3, weight: 9 }, // 659 solutions (unchanged); e.g. 23*8=184
]

const TOTAL_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0)

/**
 * Draws needed per success now average 34.0 — 26 originally, 32.0 after
 * no-multiplying-by-zero. Attempts are geometric (one draw in 34.0 succeeds);
 * measured over 200,000 generated puzzles the median was 24, the 99th percentile
 * 154, the 99.9th 231 and the worst case 386. The 4000 cap is therefore still
 * pure insurance: the chance of 4000 consecutive misses is about 1e-52, and the
 * fallback table below has never been reached outside the degenerate-rng test.
 */
const MAX_ATTEMPTS = 4000

/**
 * Hand-checked valid equations covering every answer length and operator, used
 * only if rejection sampling somehow exhausts {@link MAX_ATTEMPTS}. All twelve
 * survive both zero rules: none multiplies by zero and none divides a zero — the
 * `0` in `10+25=35` is a digit of `10`, not an operand — and `equation.test.ts`
 * re-validates every entry so the list cannot rot.
 */
const FALLBACKS: readonly string[] = [
  '9*8-64=8',
  '48/6-3=5',
  '12/4+6=9',
  '126/14=9',
  '5*4-8=12',
  '9+8*2=25',
  '10+25=35',
  '72-14=58',
  '126/9=14',
  '9*45=405',
  '23*8=184',
  '9+99=108',
]

const OP_CHARS: readonly string[] = ['+', '-', '*', '/']

/** A uniform integer in `[0, bound)`, robust to an [rng] that strays outside `[0, 1)`. */
function nextInt(rng: () => number, bound: number): number {
  const raw = Math.floor(rng() * bound)
  if (!Number.isFinite(raw) || raw < 0) return 0
  if (raw >= bound) return bound - 1
  return raw
}

/**
 * Returns a fresh valid eight-character puzzle equation, drawn from [rng]
 * (defaults to `Math.random`, and is injectable so tests can be deterministic).
 *
 * Answer lengths are spread roughly evenly across one, two and three digits,
 * with a mix of operator counts (one or two — three is impossible on eight
 * tiles) and all four operators represented. Always terminates: the search is
 * capped at {@link MAX_ATTEMPTS} draws and then falls back to a known-good
 * equation rather than looping.
 */
export function generateEquation(rng: () => number = Math.random): string {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = attempt(pickShape(rng), rng)
    if (candidate !== null) return candidate
  }
  const fallback = FALLBACKS[nextInt(rng, FALLBACKS.length)]
  return fallback ?? '9*8-64=8'
}

function pickShape(rng: () => number): Shape {
  let r = nextInt(rng, TOTAL_WEIGHT)
  for (const shape of SHAPES) {
    r -= shape.weight
    if (r < 0) return shape
  }
  const last = SHAPES[SHAPES.length - 1]
  // SHAPES is a non-empty literal, so this fallback is unreachable in practice.
  return last ?? { digits: [1, 1], rhsDigits: 1, weight: 1 }
}

/** One random draw for [shape]; null when the draw breaks a rule or misses the answer length. */
function attempt(shape: Shape, rng: () => number): string | null {
  const numbers: number[] = shape.digits.map((d) => randomNumber(d, rng))
  const ops: string[] = []
  for (let i = 0; i < numbers.length - 1; i++) {
    const op = OP_CHARS[nextInt(rng, OP_CHARS.length)]
    if (op === undefined) return null
    ops.push(op)
  }

  const r = evalTokens({ numbers, ops })
  if (!r.ok) return null
  const answer = String(r.value)
  if (answer.length !== shape.rhsDigits) return null

  const parts: string[] = []
  for (let i = 0; i < numbers.length; i++) {
    const num = numbers[i]
    if (num === undefined) return null
    if (i > 0) {
      const op = ops[i - 1]
      if (op === undefined) return null
      parts.push(op)
    }
    parts.push(String(num))
  }
  const candidate = `${parts.join('')}=${answer}`

  // Belt and braces: the shipped validator has the final say.
  return validateEquation(candidate).ok ? candidate : null
}

/** A non-negative integer with exactly [digits] digits and no leading zero. */
function randomNumber(digits: number, rng: () => number): number {
  if (digits === 1) return nextInt(rng, 10)
  let v = nextInt(rng, 9) + 1
  for (let i = 1; i < digits; i++) v = v * 10 + nextInt(rng, 10)
  return v
}
