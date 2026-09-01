/**
 * Scoring is the highest-risk code in the app, and duplicate characters are where
 * it breaks. Each case is written as a compact pattern string so the expected
 * colouring is readable at a glance:
 *
 *   G = correct, P = present, - = absent
 *
 * Ported case-for-case from `ScorerTest.kt`.
 */

import { describe, expect, it } from 'vitest'
import { score, updateKeypad } from './scorer'
import type { Tile, TileState } from './types'

const pattern = (tiles: readonly Tile[]): string =>
  tiles
    .map((t) => {
      switch (t.state) {
        case 'correct':
          return 'G'
        case 'present':
          return 'P'
        case 'absent':
          return '-'
        default:
          return '?'
      }
    })
    .join('')

const assertScored = (target: string, guess: string, expected: string): void => {
  expect(pattern(score(guess, target)), `target=${target} guess=${guess}`).toBe(expected)
}

describe('score', () => {
  it('marks an identical guess all green', () => {
    assertScored('12+34=46', '12+34=46', 'GGGGGGGG')
  })

  it('spends duplicate budget left to right', () => {
    // Target holds two 4s but only one 1. Both guessed 4s are PRESENT; the FIRST
    // guessed 1 is PRESENT and the SECOND is ABSENT. A naive includes() check
    // marks that second 1 PRESENT and is wrong.
    assertScored('12+34=46', '44+11=55', 'PPGP-G--')
  })

  it('lets exact matches claim budget before misplaced ones', () => {
    // The 4 in position 1 is exact. The leading 4 may only draw on what is left.
    assertScored('44+11=55', '14+41=55', 'PGGPGGGG')
  })

  it('exhausts the budget when a repeated character is over-guessed', () => {
    // Guess has five 2s; target "10+2=012" has only two.
    assertScored('10+2=012', '22222=22', '---G-P-G')
  })

  it('scores operators and equals under the same budget rule', () => {
    // Target has two + and one =; guess has two + and one =.
    assertScored('5+5+5=15', '1+5+9=15', '-GGG-GGG')
  })

  it('does not give operators an unlimited budget', () => {
    // Target "1+2+3=06" has two +; guess "9+9+9=99" also has two, both aligned.
    assertScored('1+2+3=06', '9+9+9=99', '-G-G-G--')
  })

  it('paints a perfect anagram with no positional match all purple', () => {
    assertScored('12+3=345', '543=3+21', 'PPPPPPPP')
  })

  it('paints nothing-in-common all black except the aligned equals', () => {
    assertScored('12+34=46', '9*9-8=73', '-----G-P')
  })

  it('rejects a guess of the wrong length', () => {
    expect(() => score('12+34=4', '12+34=46')).toThrow()
  })
})

describe('updateKeypad', () => {
  it('never regresses a key', () => {
    let keypad: Record<string, TileState> = {}

    // First guess: 4 lands misplaced -> present.
    keypad = updateKeypad(keypad, score('44+11=55', '12+34=46'))
    expect(keypad['4']).toBe('present')

    // Second guess: 4 lands exactly -> upgrades to correct.
    keypad = updateKeypad(keypad, score('12+34=46', '12+34=46'))
    expect(keypad['4']).toBe('correct')

    // Third guess puts 4 in the wrong column again. It must NOT drop back.
    keypad = updateKeypad(keypad, score('44+11=55', '12+34=46'))
    expect(keypad['4'], 'green key must not downgrade to purple').toBe('correct')
  })

  it('does not let absent overwrite a known present', () => {
    const keypad = updateKeypad({ '7': 'present' }, [{ char: '7', state: 'absent' }])
    expect(keypad['7']).toBe('present')
  })

  it('does not mutate the map it is given', () => {
    const before: Record<string, TileState> = { '1': 'absent' }
    const after = updateKeypad(before, [{ char: '1', state: 'correct' }])
    expect(before['1']).toBe('absent')
    expect(after['1']).toBe('correct')
  })
})
