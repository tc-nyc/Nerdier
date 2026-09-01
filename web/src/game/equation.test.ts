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
    }
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
