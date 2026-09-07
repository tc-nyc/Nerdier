/**
 * The arithmetic layer: generation, validation, evaluation, commutativity.
 * Ported from the Android build's `EquationEngineTest.kt`.
 */

import { describe, it, expect } from 'vitest'
import {
  generateEquation,
  validateEquation,
  evaluateExpression,
  isCommutativelyEquivalent,
} from './equation'
import { EQUATION_LENGTH } from './types'

/**
 * mulberry32 — a tiny, dependency-free PRNG so generator tests are deterministic.
 * Stands in for Kotlin's `Random(seed)`; sequences differ from the JVM's, but
 * every run of this suite draws exactly the same numbers.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const accepts = (s: string): boolean => validateEquation(s).ok

const reason = (s: string): string => {
  const r = validateEquation(s)
  return r.ok ? '' : r.reason
}

const rhsOf = (eq: string): string => eq.slice(eq.indexOf('=') + 1)
const lhsOf = (eq: string): string => eq.slice(0, eq.indexOf('='))

// ---- validation -----------------------------------------------------------

describe('validation', () => {
  it('accepts well formed equations', () => {
    for (const eq of ['12+34=46', '12*9=108', '100-1=99', '100/2=50', '1+9/1=10']) {
      expect(accepts(eq), `should accept ${eq}`).toBe(true)
    }
  })

  it('rejects arithmetic that does not balance', () => {
    expect(accepts('51+21=42')).toBe(false)
    // The message must name the real value, not just say "invalid".
    expect(reason('51+21=42')).toContain('72')
    expect(reason('51+21=42')).toBe('51+21=42 — the left side equals 72')
  })

  it('rejects wrong length', () => {
    expect(accepts('1+2=3')).toBe(false)
    expect(accepts('123+456=579')).toBe(false)
    expect(reason('1+2=3')).toBe("That's only 5 characters — equations are exactly 8")
    expect(reason('123+456=579')).toBe("That's 11 characters — equations are exactly 8")
  })

  it('requires exactly one equals sign', () => {
    expect(accepts('12+34946')).toBe(false)
    expect(reason('12+34946')).toBe('Needs exactly one = sign')
    expect(accepts('1+2=3=48')).toBe(false)
    expect(reason('1+2=3=48')).toBe('Only one = sign allowed')
  })

  it('rejects operators on the right hand side', () => {
    expect(accepts('12=34-22')).toBe(false)
    expect(reason('12=34-22')).toBe('Operators belong on the left of the =')
  })

  it('rejects inexact division and division by zero', () => {
    expect(accepts('100/8=12'), '100/8 is 12.5, not a whole number').toBe(false)
    expect(reason('100/8=12')).toBe("100/8 isn't a whole number")
    expect(accepts('12/0=120'), 'division by zero').toBe(false)
    expect(reason('12/0=120')).toBe("Can't divide by zero")
  })

  it('rejects negative intermediate results', () => {
    // 0-1 dips to -1 before +10 brings it back to a legitimate 9. The final
    // value is correct and every other rule is satisfied, so this equation is
    // rejected for the intermediate alone.
    expect(accepts('0-1+10=9')).toBe(false)
    expect(accepts('0-2+10=8')).toBe(false)
    expect(reason('0-1+10=9')).toBe('0-1 goes negative — no negative numbers')
  })

  it('rejects leading zeros', () => {
    expect(accepts('05+1=006')).toBe(false)
    expect(accepts('5+05=010')).toBe(false)
    expect(reason('05+1=006')).toBe("Numbers can't start with 0")
    expect(reason('5+05=010')).toBe("Numbers can't start with 0")
  })

  it('requires at least one operator on the left', () => {
    expect(accepts('12345=12')).toBe(false)
    expect(reason('12345=12')).toBe('The left side needs at least one operator')
  })

  it('rejects adjacent or dangling operators', () => {
    expect(accepts('5++3=008')).toBe(false)
    expect(accepts('+5+3=008')).toBe(false)
    expect(accepts('5+3+=008')).toBe(false)
  })

  it('rejects characters outside the alphabet', () => {
    expect(accepts('1+2=3a b')).toBe(false)
    expect(reason('1+2=3a b')).toBe("'a' isn't allowed — use digits, + - * / and =")
  })

  it('caps the answer at three digits', () => {
    expect(accepts('9=100000')).toBe(false)
    expect(reason('9=100000')).toBe('The answer can be at most 3 digits')
  })

  it('every rejection carries a specific reason', () => {
    const junk = ['1+2=3', '51+21=42', '05+1=006', '12/0=120', '5++3=008', '12345=12', '0-1+10=9']
    for (const g of junk) {
      const r = validateEquation(g)
      expect(r.ok, `${g} should be rejected`).toBe(false)
      const msg = r.ok ? '' : r.reason
      expect(msg.length, `reason too vague for '${g}': ${msg}`).toBeGreaterThan(8)
    }
  })
})

// ---- evaluation -----------------------------------------------------------

describe('evaluation', () => {
  it('respects order of operations', () => {
    expect(evaluateExpression('2*3+4')).toBe(10)
    expect(evaluateExpression('2+3*4')).toBe(14)
    expect(evaluateExpression('8/4/1')).toBe(2)
  })

  it('is total and never throws', () => {
    for (const s of ['', '=', '++', '9/0', 'abc', '9'.repeat(40), '1+', '/2', '1+2=3']) {
      expect(() => evaluateExpression(s)).not.toThrow()
    }
    expect(evaluateExpression('9/0')).toBeNull()
    expect(evaluateExpression('')).toBeNull()
    expect(evaluateExpression('1+1')).not.toBeNull()
  })

  it('evaluates a bare number to itself but rejects a negative intermediate', () => {
    expect(evaluateExpression('42')).toBe(42)
    expect(evaluateExpression('3-5+4')).toBeNull()
    expect(evaluateExpression('7/2')).toBeNull()
    expect(evaluateExpression('05+1')).toBeNull()
  })
})

// ---- commutativity --------------------------------------------------------

describe('commutativity', () => {
  it('addition and multiplication commute', () => {
    expect(isCommutativelyEquivalent('12+34=46', '34+12=46')).toBe(true)
    expect(isCommutativelyEquivalent('12*9=108', '9*12=108')).toBe(true)
    expect(isCommutativelyEquivalent('1+2+3=6', '3+2+1=6')).toBe(true)
    expect(isCommutativelyEquivalent('2*3+4=10', '4+3*2=10')).toBe(true)
    expect(isCommutativelyEquivalent('5+3=8', '3+5=8')).toBe(true)
    expect(isCommutativelyEquivalent('4*2=8', '2*4=8')).toBe(true)
  })

  it('subtraction and division do not commute', () => {
    expect(isCommutativelyEquivalent('83-13=70', '13-83=70')).toBe(false)
    expect(isCommutativelyEquivalent('100/2=50', '2/100=50')).toBe(false)
    expect(isCommutativelyEquivalent('8-3=5', '3-8=5')).toBe(false)
  })

  it('does not reorder across a non-commutative operator', () => {
    // Both are legal eight-tile puzzles and both equal 10, but the trees differ:
    // -(+(5,9),4) vs +(-(9,4),5). Nothing reorders across the subtraction.
    expect(accepts('5+9-4=10')).toBe(true)
    expect(accepts('9-4+5=10')).toBe(true)
    expect(isCommutativelyEquivalent('5+9-4=10', '9-4+5=10')).toBe(false)
    // The documented short illustration behaves the same way. (Equivalence does
    // not impose the eight-tile length, so a 7-char example is fair game here.)
    expect(isCommutativelyEquivalent('3+5-2=6', '5-2+3=6')).toBe(false)
  })

  it('same value with different numbers is not equivalent', () => {
    expect(isCommutativelyEquivalent('12+34=46', '23+23=46')).toBe(false)
  })

  it('rejects malformed input on either side', () => {
    expect(isCommutativelyEquivalent('5++3=8', '5++3=8')).toBe(false)
    expect(isCommutativelyEquivalent('5+3=9', '5+3=9')).toBe(false)
    expect(isCommutativelyEquivalent('5+3', '5+3')).toBe(false)
  })

  it('is reflexive and symmetric over generated puzzles', () => {
    const rng = mulberry32(20260821)
    for (let i = 0; i < 500; i++) {
      const a = generateEquation(rng)
      expect(isCommutativelyEquivalent(a, a)).toBe(true)
      const b = generateEquation(rng)
      expect(isCommutativelyEquivalent(a, b)).toBe(isCommutativelyEquivalent(b, a))
    }
  })
})

// ---- no multiplying by zero ----------------------------------------------

/**
 * An independent restatement of the rule, written from the spec rather than
 * lifted from equation.ts, so the two implementations can disagree and the fuzz
 * will notice. True when any multiplication has zero as an operand *by value*.
 */
function multipliesByZero(lhs: string): boolean {
  const nums = lhs.split(/[+\-*/]/).map(Number)
  const ops = [...lhs].filter((c) => '+-*/'.includes(c))
  let term = nums[0] ?? Number.NaN
  for (let i = 0; i < ops.length; i++) {
    const next = nums[i + 1] ?? Number.NaN
    if (ops[i] === '*') {
      if (term === 0 || next === 0) return true
      term *= next
    } else if (ops[i] === '/') {
      if (next === 0) return false
      term /= next
    } else {
      term = next
    }
  }
  return false
}

/**
 * The same trick for Addendum 6, again written from the spec rather than lifted
 * from equation.ts. True when any division has zero as its dividend *by value*.
 * Returns false the moment it meets a zero divisor, because dividing by zero is
 * a different rule with its own, older message.
 */
function dividesZero(lhs: string): boolean {
  const nums = lhs.split(/[+\-*/]/).map(Number)
  const ops = [...lhs].filter((c) => '+-*/'.includes(c))
  let term = nums[0] ?? Number.NaN
  for (let i = 0; i < ops.length; i++) {
    const next = nums[i + 1] ?? Number.NaN
    if (ops[i] === '/') {
      if (next === 0) return false
      if (term === 0) return true
      term /= next
    } else if (ops[i] === '*') {
      term *= next
    } else {
      term = next
    }
  }
  return false
}

const ZERO_MUL = 'No multiplying by zero'
const ZERO_DIV = 'No dividing zero'

describe('no multiplying by zero', () => {
  it('rejects a zero operand on either side of a *', () => {
    // Every one of these was a legal puzzle before the rule: each arithmetic
    // statement is true, so only the new rule can be rejecting them.
    for (const eq of ['0*76+5=5', '70*0+5=5', '4+92*0=4', '0*7*10=0', '17*0+5=5']) {
      expect(accepts(eq), `should reject ${eq}`).toBe(false)
      expect(reason(eq), `wrong message for ${eq}`).toBe(ZERO_MUL)
    }
  })

  it("rejects the principal's 0*7 and 7*0 in eight-tile form", () => {
    // `0*7=0` and `7*0=0` are only five tiles, so the length rule fires first
    // and the guess never reaches the arithmetic — that ordering is unchanged.
    expect(accepts('0*7=0')).toBe(false)
    expect(reason('0*7=0')).toBe("That's only 5 characters — equations are exactly 8")
    expect(accepts('7*0=0')).toBe(false)
    expect(reason('7*0=0')).toBe("That's only 5 characters — equations are exactly 8")
    // At eight tiles the rule itself is what rejects them.
    expect(reason('0*7*10=0')).toBe(ZERO_MUL) // contains 0*7
    expect(reason('7*0*10=0')).toBe(ZERO_MUL) // contains 7*0
    // And the longer form from the spec.
    expect(reason('4+92*0=4')).toBe(ZERO_MUL)
  })

  it('leaves zero alone everywhere except as a multiplicand', () => {
    // A zero operand is still a fine operand for + and -, and a zero *digit*
    // inside a longer number is untouched: the 0 of `10` is not an operand.
    for (const eq of ['0+5*9=45', '5*9+0=45', '10-0-4=6', '5-0+9=14']) {
      expect(accepts(eq), `should still accept ${eq}`).toBe(true)
    }
    // A zero *digit* inside a multiplied operand is not a zero operand.
    for (const eq of ['9*40=360', '20*5=100', '40*5=200']) {
      expect(accepts(eq), `should still accept ${eq}`).toBe(true)
    }
  })

  it('0/5 is not multiplying by zero — it now breaks the other zero rule', () => {
    // Addendum 5 made this the deliberate boundary: `0/55+7=7` was legal because
    // dividing zero is not multiplying by zero. Addendum 6 banned dividing zero
    // too, so the equation is now rejected — but by the *other* rule, which is
    // what this case still pins down. The evaluator is unchanged either way.
    expect(evaluateExpression('0/5')).toBe(0)
    expect(reason('0/55+7=7'), 'rejected as dividing zero, not as multiplying by zero').toBe(
      ZERO_DIV,
    )
    expect(accepts('12/0=120')).toBe(false)
    expect(reason('12/0=120')).toBe("Can't divide by zero")
  })

  it('catches a zero that only appears part-way through a term', () => {
    // `0/1*10` writes no `0` next to the `*`, but the left operand of that
    // multiplication *is* zero once `0/1` has been worked out — so it is
    // multiplying by zero and is rejected. This is the strict reading: the rule
    // is about operand values, not about which characters sit next to the `*`.
    expect(accepts('0/1*10=0')).toBe(false)
    expect(reason('0/1*10=0')).toBe(ZERO_MUL)
  })

  it('is a puzzle rule, not an arithmetic one', () => {
    // evaluateExpression is deliberately unchanged: it still does the sum.
    // Legality is validateEquation's job, exactly as with "needs an operator".
    expect(evaluateExpression('0*7')).toBe(0)
    expect(evaluateExpression('4+92*0')).toBe(4)
    expect(evaluateExpression('0/1*10')).toBe(0)
  })

  it('agrees with an independently written check across the legal space', () => {
    const samples = [
      '0*76+5=5',
      '70*0+5=5',
      '4+92*0=4',
      '0/1*10=0',
      '0+5*9=45',
      '10-0-4=6',
      '0/55+7=7',
      '12+34=46',
      '12*9=108',
    ]
    for (const eq of samples) {
      const lhs = lhsOf(eq)
      // Every sample balances arithmetically, so acceptance turns purely on the
      // two zero rules.
      expect(accepts(eq), `disagreement on ${eq}`).toBe(
        !multipliesByZero(lhs) && !dividesZero(lhs),
      )
    }
  })
})

// ---- no dividing zero ------------------------------------------------------

describe('no dividing zero', () => {
  it('rejects a division whose dividend is zero', () => {
    // The principal's example plus the same shape elsewhere in an expression.
    // Every one of these was a legal puzzle until Addendum 6: each arithmetic
    // statement is true and nothing is multiplied by zero, so only the new rule
    // can be rejecting them.
    for (const eq of ['0/1234=0', '0/55+7=7', '9-0/12=9', '0/12+9=9', '7+0/25=7']) {
      expect(accepts(eq), `should reject ${eq}`).toBe(false)
      expect(reason(eq), `wrong message for ${eq}`).toBe(ZERO_DIV)
    }
  })

  it('catches a zero dividend that is evaluated rather than written', () => {
    // `0/16/2` divides zero twice: the written `0/16`, and then a second
    // division whose dividend is only zero once `0/16` has been worked out. The
    // rule is read by operand value, so the chain is rejected as a whole.
    //
    // A by-value zero dividend cannot occur without a written one: inside a
    // multiplicative term the running value only reaches zero through `*0`
    // (already illegal) or through a `0/x` that is itself a written violation,
    // and `+`/`-` start the next term at its written operand. So this case
    // pins the evaluated reading rather than isolating it.
    for (const eq of ['0/16/2=0', '0/12/6=0', '0/2/34=0']) {
      expect(accepts(eq), `should reject ${eq}`).toBe(false)
      expect(reason(eq), `wrong message for ${eq}`).toBe(ZERO_DIV)
    }
  })

  it('does not steal the divide-by-zero message', () => {
    // Dividing *by* zero keeps its own older, more specific wording.
    expect(reason('12/0=120')).toBe("Can't divide by zero")
    expect(reason('12/0=120')).not.toBe(ZERO_DIV)
    // `0/0` breaks both readings at once; the divisor is the more specific
    // complaint, so it wins.
    expect(reason('0/0+55=5')).toBe("Can't divide by zero")
    expect(reason('5+12/0=5')).toBe("Can't divide by zero")
  })

  it('leaves the multiplication message alone where both rules apply', () => {
    // `0/1*10` divides zero and then multiplies by it. Reporting order is
    // unchanged from Addendum 5: multiplication is named.
    expect(reason('0/1*10=0')).toBe(ZERO_MUL)
    expect(reason('0/1*10=0')).not.toBe(ZERO_DIV)
  })

  it('leaves zero alone everywhere except as a dividend or a multiplicand', () => {
    // Zero is still a fine operand for + and -, and unaffected inside a number.
    for (const eq of ['10-0-4=6', '5-0+9=14', '0+5*9=45', '0+9*7=63']) {
      expect(accepts(eq), `should still accept ${eq}`).toBe(true)
    }
    // A zero *digit* inside a longer number is not a zero operand, whether that
    // number is multiplied or divided.
    for (const eq of ['9*40=360', '20*5=100', '100/2=50', '105/5=21']) {
      expect(accepts(eq), `should still accept ${eq}`).toBe(true)
    }
  })

  it('is a puzzle rule, not an arithmetic one', () => {
    // evaluateExpression is deliberately unchanged: it still does the sum.
    expect(evaluateExpression('0/1234')).toBe(0)
    expect(evaluateExpression('0/16/2')).toBe(0)
    expect(evaluateExpression('9-0/12')).toBe(9)
  })

  it('agrees with an independently written check', () => {
    const samples = [
      '0/1234=0',
      '0/55+7=7',
      '9-0/12=9',
      '0/16/2=0',
      '0/1*10=0',
      '10-0-4=6',
      '0+5*9=45',
      '100/2=50',
      '12+34=46',
      '1+9/1=10',
    ]
    for (const eq of samples) {
      const lhs = lhsOf(eq)
      expect(accepts(eq), `disagreement on ${eq}`).toBe(
        !multipliesByZero(lhs) && !dividesZero(lhs),
      )
    }
  })
})

// ---- generator ------------------------------------------------------------

describe('generator', () => {
  it('every generated puzzle passes the validator', () => {
    // The anti-drift check: generator and validator must agree on every rule.
    const rng = mulberry32(7)
    for (let i = 0; i < 20_000; i++) {
      const eq = generateEquation(rng)
      expect(eq.length, `wrong length: ${eq}`).toBe(EQUATION_LENGTH)
      const v = validateEquation(eq)
      expect(
        v.ok,
        `generator emitted an equation its own validator rejects: ${eq} (${v.ok ? '' : v.reason})`,
      ).toBe(true)
      // Checked independently of the validator, so a hole in one would not hide
      // a hole in the other.
      expect(
        multipliesByZero(lhsOf(eq)),
        `generator emitted a zero-operand multiplication: ${eq}`,
      ).toBe(false)
      expect(dividesZero(lhsOf(eq)), `generator emitted a zero dividend: ${eq}`).toBe(false)
    }
  })

  it('never falls back to an equation that breaks a rule', () => {
    // The fallback list only fires if rejection sampling exhausts MAX_ATTEMPTS,
    // which effectively never happens — so it is exactly the sort of table that
    // rots unnoticed. A constant rng can satisfy no shape, so every draw fails
    // and the very last call to the rng is the one that indexes the fallbacks.
    // Count that call, then replay with each index forced, to reach all of them.
    let calls = 0
    generateEquation(() => {
      calls++
      return 0
    })

    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      let n = 0
      const eq = generateEquation(() => {
        n++
        return n === calls ? i / 40 : 0
      })
      seen.add(eq)
      const v = validateEquation(eq)
      expect(v.ok, `fallback ${eq} is not a legal equation (${v.ok ? '' : v.reason})`).toBe(true)
      expect(multipliesByZero(lhsOf(eq)), `fallback ${eq} multiplies by zero`).toBe(false)
      expect(dividesZero(lhsOf(eq)), `fallback ${eq} divides zero`).toBe(false)
    }
    // The 40 forced indices sweep the whole table, whatever its length.
    expect(seen.size, 'the sweep should reach every fallback').toBeGreaterThanOrEqual(12)
  })

  it('produces a real spread of answers and operators', () => {
    const rng = mulberry32(99)
    const puzzles = Array.from({ length: 5_000 }, () => generateEquation(rng))

    const answerLengths = new Set(puzzles.map((p) => rhsOf(p).length))
    expect([...answerLengths].sort(), 'answers should span 1, 2 and 3 digits').toEqual([1, 2, 3])

    const operators = new Set(puzzles.flatMap((p) => [...lhsOf(p)].filter((c) => '+-*/'.includes(c))))
    expect([...operators].sort(), 'all four operators should appear').toEqual(['*', '+', '-', '/'])

    expect(new Set(puzzles).size, 'generator is too repetitive').toBeGreaterThan(500)
  })

  it('is deterministic for a fixed seed', () => {
    const a = Array.from({ length: 50 }, () => generateEquation(mulberry32(1234)))
    const b = Array.from({ length: 50 }, () => generateEquation(mulberry32(1234)))
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(1)
  })

  it('defaults to Math.random and still terminates on a degenerate rng', () => {
    expect(validateEquation(generateEquation()).ok).toBe(true)
    // A constant rng can never satisfy a shape, so the fallback table must fire.
    expect(validateEquation(generateEquation(() => 0)).ok).toBe(true)
    expect(validateEquation(generateEquation(() => 0.999999)).ok).toBe(true)
  })
})
