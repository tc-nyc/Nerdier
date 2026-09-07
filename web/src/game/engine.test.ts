/**
 * Engine behaviour, driven through a stubbed `EquationRules` so these tests are
 * independent of the arithmetic implementation (`equation.ts` is the
 * math-wizard's file and is deliberately never imported here).
 *
 * Ported case-for-case from `GameEngineTest.kt`.
 */

import { describe, expect, it } from 'vitest'
import { GameEngine } from './engine'
import type { EquationRules } from './engine'
import { EQUATION_LENGTH, MAX_GUESSES, isRowComplete, rowEquation, rowText } from './types'
import type { Row, ValidationResult } from './types'

/** Accepts anything in `accept`; rejects everything else with a fixed reason. */
function stubRules(options: {
  accept?: readonly string[]
  equivalent?: readonly (readonly [string, string])[]
  reason?: string
}): EquationRules {
  const accept = new Set(options.accept ?? [])
  const equivalent = options.equivalent ?? []
  const reason = options.reason ?? "Nope, that doesn't add up."
  return {
    generate: (): string => '12+34=46',
    validate: (guess: string): ValidationResult =>
      accept.has(guess) ? { ok: true } : { ok: false, reason },
    isCommutativelyEquivalent: (a: string, b: string): boolean =>
      a === b || equivalent.some(([x, y]) => (x === a && y === b) || (x === b && y === a)),
  }
}

const type = (engine: GameEngine, text: string): void => {
  for (const c of text) engine.keyPress(c)
}

const firstRow = (engine: GameEngine): Row => {
  const row: Row | undefined = engine.snapshot().rows[0]
  if (row === undefined) throw new Error('board has no first row')
  return row
}

/** Characters only, gaps skipped — display shape, never a guess. */
const firstRowText = (engine: GameEngine): string => rowText(firstRow(engine))

/**
 * The active row rendered with `_` for a gap, so a hole is visible in the
 * assertion instead of being silently compacted away by `rowText`.
 */
const rowPattern = (engine: GameEngine, index = 0): string => {
  const row = engine.snapshot().rows[index]
  if (row === undefined) throw new Error(`no row ${index}`)
  return row.tiles.map((t) => t.char ?? '_').join('')
}

describe('row consumption', () => {
  it('rejects a short row without consuming a guess', () => {
    const engine = new GameEngine(stubRules({ accept: ['12+34=46'] }), '12+34=46')
    type(engine, '12+34')

    const result = engine.submit()

    expect(result.ok).toBe(false)
    expect(engine.guessesUsed).toBe(0)
    expect(engine.currentRow).toBe(0)
    expect(engine.status).toBe('in-progress')
  })

  it('does not consume a guess for an invalid equation and leaves the row editable', () => {
    const engine = new GameEngine(stubRules({ accept: ['12+34=46'] }), '12+34=46')
    type(engine, '51+21=42')

    const result = engine.submit()

    expect(result.ok).toBe(false)
    expect(engine.guessesUsed, 'no guess may be spent on a rejected equation').toBe(0)
    expect(engine.currentRow).toBe(0)

    // The row is still editable in place: delete a character and resubmit.
    engine.delete()
    engine.keyPress('6')
    expect(firstRowText(engine)).toBe('51+21=46')
  })

  it('surfaces the validator reason verbatim', () => {
    const reason = '51+21=42 — the left side equals 72'
    const engine = new GameEngine(stubRules({ accept: [], reason }), '12+34=46')
    type(engine, '51+21=42')

    const result = engine.submit()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe(reason)
  })

  it('advances the row only on valid submissions', () => {
    const engine = new GameEngine(stubRules({ accept: ['11+11=22'] }), '12+34=46')

    for (let i = 0; i < 3; i++) {
      type(engine, '99999999')
      engine.submit()
      for (let j = 0; j < 8; j++) engine.delete()
    }
    expect(engine.guessesUsed).toBe(0)

    type(engine, '11+11=22')
    engine.submit()
    expect(engine.guessesUsed).toBe(1)
    expect(engine.currentRow).toBe(1)
  })
})

describe('winning', () => {
  it('wins on an exact guess', () => {
    const engine = new GameEngine(stubRules({ accept: ['12+34=46'] }), '12+34=46')
    type(engine, '12+34=46')

    const result = engine.submit()

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.won).toBe(true)
    expect(engine.status).toBe('won')
  })

  it('wins on a commutative rearrangement even though the tiles are not all green', () => {
    // This is the bug the whole design guards against: a win that does NOT look
    // like a win on the board.
    const engine = new GameEngine(
      stubRules({
        accept: ['34+12=46'],
        equivalent: [['34+12=46', '12+34=46']],
      }),
      '12+34=46',
    )
    type(engine, '34+12=46')

    const result = engine.submit()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.won, 'commutative guess must win').toBe(true)
    expect(engine.status).toBe('won')
    expect(
      result.tiles.every((t) => t.state === 'correct'),
      'precondition: this guess is deliberately not all-green',
    ).toBe(false)
  })

  it('does not win on a non-commutative rearrangement', () => {
    // Subtraction does not commute: 83-78=05 must not be satisfied by 78-83=05.
    const engine = new GameEngine(stubRules({ accept: ['78-83=05'] }), '83-78=05')
    type(engine, '78-83=05')

    const result = engine.submit()

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.won).toBe(false)
    expect(engine.status).not.toBe('won')
  })
})

describe('losing', () => {
  it('loses after six consumed rows without a win', () => {
    const engine = new GameEngine(stubRules({ accept: ['11+11=22'] }), '12+34=46')

    for (let i = 0; i < MAX_GUESSES; i++) {
      type(engine, '11+11=22')
      expect(engine.submit().ok).toBe(true)
      for (let j = 0; j < 8; j++) engine.delete()
    }

    expect(engine.guessesUsed).toBe(MAX_GUESSES)
    expect(engine.status).toBe('lost')
    expect(engine.target, 'target is revealed on loss').toBe('12+34=46')
  })

  it('ignores input once the game is over', () => {
    const engine = new GameEngine(stubRules({ accept: ['12+34=46'] }), '12+34=46')
    type(engine, '12+34=46')
    engine.submit()

    engine.keyPress('9')
    expect(engine.submit().ok).toBe(false)
    expect(engine.guessesUsed).toBe(1)
  })
})

describe('typing', () => {
  it('will not overflow a row past eight characters', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '123456789999')
    expect(firstRowText(engine)).toHaveLength(8)
  })

  it('treats delete on an empty row as a no-op', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    for (let i = 0; i < 5; i++) engine.delete()
    expect(firstRowText(engine)).toBe('')
  })

  it('ignores keys that are not on the keypad', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '1a2 3')
    expect(firstRowText(engine)).toBe('123')
  })

  it('generates its target from the rules when none is given', () => {
    const engine = new GameEngine(stubRules({}))
    expect(engine.target).toBe('12+34=46')
  })

  it('rejects a target of the wrong length', () => {
    expect(() => new GameEngine(stubRules({}), '1+1=2')).toThrow()
  })
})

describe('free cursor — crossword-style entry', () => {
  it('starts with the cursor on the first tile', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    expect(engine.cursor).toBe(0)
    expect(engine.snapshot().cursor).toBe(0)
  })

  it('types at a clicked position and leaves the tiles before it empty', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')

    engine.moveCursor(5)
    engine.keyPress('7')

    expect(rowPattern(engine)).toBe('_____7__')
    expect(engine.cursor).toBe(6)
    // Positions 0..4 are untouched.
    expect(firstRow(engine).tiles.slice(0, 5).every((t) => t.char === null)).toBe(true)
    expect(isRowComplete(firstRow(engine)), 'a row with holes is not complete').toBe(false)
    expect(rowEquation(firstRow(engine))).toBeNull()
  })

  it('overwrites a filled position without disturbing its neighbours', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    engine.moveCursor(3)
    engine.keyPress('9')

    expect(rowPattern(engine)).toBe('12+94=46')
    expect(engine.cursor, 'overwriting still advances the caret').toBe(4)
  })

  it('clamps a click outside the row', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')

    engine.moveCursor(99)
    expect(engine.cursor).toBe(EQUATION_LENGTH - 1)
    engine.moveCursor(-4)
    expect(engine.cursor).toBe(0)
  })

  it('advances to the last tile and stops there instead of wrapping', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')

    type(engine, '1234567')
    expect(engine.cursor).toBe(7)

    engine.keyPress('8')
    expect(engine.cursor, 'the caret must not run off the end').toBe(7)
    expect(rowPattern(engine)).toBe('12345678')

    // A ninth press overwrites tile 7; it must NOT wrap round to tile 0.
    engine.keyPress('9')
    expect(engine.cursor).toBe(7)
    expect(rowPattern(engine)).toBe('12345679')
  })

  it('backspaces the LAST tile of a full row rather than stranding it', () => {
    // The caret stops on tile 7, so without the end-of-row exception the final
    // character of a full row could never be backspaced away.
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')
    expect(engine.cursor).toBe(EQUATION_LENGTH - 1)

    engine.backspace()

    expect(rowPattern(engine), 'tile 7 goes, tile 6 stays').toBe('12+34=4_')
    expect(engine.cursor, 'the caret has nowhere further right to sit').toBe(EQUATION_LENGTH - 1)
  })

  it('falls through to the normal leftward rule on the second backspace', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    engine.backspace()
    engine.backspace()

    expect(rowPattern(engine)).toBe('12+34=__')
    expect(engine.cursor).toBe(EQUATION_LENGTH - 2)
  })

  it('backspaces leftward at tile 7 when tile 7 is already empty', () => {
    // The exception is conditional on that tile actually holding a character.
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=4')
    engine.moveCursor(EQUATION_LENGTH - 1)
    expect(rowPattern(engine)).toBe('12+34=4_')

    engine.backspace()

    expect(rowPattern(engine), 'an empty tile 7 clears tile 6 as usual').toBe('12+34=__')
    expect(engine.cursor).toBe(EQUATION_LENGTH - 2)
  })

  it('backspaces the tile before the caret and moves there', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    engine.moveCursor(4)
    engine.backspace()

    expect(rowPattern(engine)).toBe('12+_4=46')
    expect(engine.cursor).toBe(3)
  })

  it('backspace at the first tile clears it and stays put', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    engine.moveCursor(0)
    engine.backspace()

    expect(rowPattern(engine)).toBe('_2+34=46')
    expect(engine.cursor, 'there is nowhere before tile 0 to move to').toBe(0)
  })

  it('exposes backspace under the legacy delete() name', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12')
    engine.delete()
    expect(rowPattern(engine)).toBe('1_______')
    expect(engine.cursor).toBe(1)
  })

  it('clears at the caret without moving it', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    engine.moveCursor(2)
    engine.clearAtCursor()

    expect(rowPattern(engine)).toBe('12_34=46')
    expect(engine.cursor, 'Delete does not move the caret').toBe(2)
  })

  it('clamps the arrow keys at both ends', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')

    engine.moveCursorLeft()
    expect(engine.cursor, 'ArrowLeft at 0 stays at 0').toBe(0)

    engine.moveCursorRight()
    expect(engine.cursor).toBe(1)

    for (let i = 0; i < 20; i++) engine.moveCursorRight()
    expect(engine.cursor, 'ArrowRight clamps at the last tile').toBe(EQUATION_LENGTH - 1)

    engine.moveCursorLeft()
    expect(engine.cursor).toBe(EQUATION_LENGTH - 2)
  })

  it('ignores cursor movement once the game is over', () => {
    const engine = new GameEngine(stubRules({ accept: ['12+34=46'] }), '12+34=46')
    type(engine, '12+34=46')
    engine.submit()
    expect(engine.status).toBe('won')

    engine.moveCursor(4)
    engine.moveCursorRight()
    expect(engine.cursor, 'clicking a tile in a finished game does nothing').toBe(0)
  })

  it('rejects a row with a hole without consuming a guess', () => {
    // `1_+34=46`: rowText would compact this to the 7-character '1+34=46' and,
    // worse, a naive 8-char build could submit an equation nobody typed.
    const engine = new GameEngine(stubRules({ accept: ['1+34=46', '12+34=46'] }), '12+34=46')
    type(engine, '12+34=46')
    engine.moveCursor(1)
    engine.clearAtCursor()

    expect(rowPattern(engine)).toBe('1_+34=46')
    expect(rowText(firstRow(engine)), 'precondition: rowText hides the gap').toBe('1+34=46')

    const result = engine.submit()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('Fill all 8 tiles — 1 to go.')
    expect(engine.guessesUsed, 'a gap must not spend a guess').toBe(0)
    expect(engine.currentRow).toBe(0)
    expect(engine.status).toBe('in-progress')
    // And the row is untouched, gap included.
    expect(rowPattern(engine)).toBe('1_+34=46')
  })

  it('counts the missing tiles, not the typed ones, in the fill-all message', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    engine.moveCursor(5)
    engine.keyPress('7')

    const result = engine.submit()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('Fill all 8 tiles — 7 to go.')
  })

  it('resets the cursor to the first tile of the new row after a valid submit', () => {
    const engine = new GameEngine(stubRules({ accept: ['11+11=22'] }), '12+34=46')
    type(engine, '11+11=22')
    expect(engine.cursor).toBe(EQUATION_LENGTH - 1)

    expect(engine.submit().ok).toBe(true)

    expect(engine.currentRow).toBe(1)
    expect(engine.cursor).toBe(0)

    // Typing goes into row 1 from the top; row 0 is left alone.
    engine.keyPress('9')
    expect(rowPattern(engine, 1)).toBe('9_______')
    expect(rowPattern(engine, 0)).toBe('11+11=22')
  })

  it('leaves the cursor alone when a submit is rejected', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '11111111')
    engine.moveCursor(2)

    engine.submit()

    expect(engine.cursor, 'the player edits in place, so the caret must not jump').toBe(2)
  })
})

describe('on-screen DELETE — clear at the caret, else backspace', () => {
  it('clears the caret tile in place, leaving the caret and the neighbours alone', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    engine.moveCursor(3)
    engine.deleteAtCursorOrBackspace()

    expect(rowPattern(engine), 'only tile 3 goes').toBe('12+_4=46')
    expect(engine.cursor, 'the caret stays on the tile it cleared').toBe(3)

    // The point of staying put: the replacement can be typed immediately, into
    // the same position.
    engine.keyPress('9')
    expect(rowPattern(engine)).toBe('12+94=46')
  })

  it('falls back to backspace when the caret tile is already empty', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    // Tile 3 is now the empty one and the caret is on it.
    engine.moveCursor(3)
    engine.deleteAtCursorOrBackspace()
    expect(rowPattern(engine)).toBe('12+_4=46')

    engine.deleteAtCursorOrBackspace()

    expect(rowPattern(engine), 'the tile to the left goes').toBe('12__4=46')
    expect(engine.cursor, 'and the caret follows it').toBe(2)
  })

  it('empties a full row under repeated presses from the last tile', () => {
    // The phone case: no physical keyboard, so DELETE must be able to clear the
    // whole row on its own.
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')
    expect(engine.cursor).toBe(EQUATION_LENGTH - 1)

    const walk: string[] = []
    for (let i = 0; i < 9; i++) {
      expect(engine.canDelete, `press ${i + 1} must be enabled`).toBe(i < 8)
      engine.deleteAtCursorOrBackspace()
      walk.push(`${rowPattern(engine)}@${engine.cursor}`)
    }

    expect(walk).toEqual([
      '12+34=4_@7', // tile 7 held a character: cleared in place, caret stays
      '12+34=__@6', // tile 7 now empty: backspace clears tile 6 and moves there
      '12+34___@5', // and from here every press is the backspace fallback
      '12+3____@4',
      '12+_____@3',
      '12______@2',
      '1_______@1',
      '________@0',
      '________@0', // caret at 0 on an empty tile: nothing left to do
    ])
    expect(rowPattern(engine), 'DELETE alone can empty the row').toBe('________')
  })

  it('clears tile 0 in place when the caret is at 0 and tile 0 is filled', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    engine.moveCursor(0)
    expect(engine.canDelete).toBe(true)
    engine.deleteAtCursorOrBackspace()

    expect(rowPattern(engine)).toBe('_2+34=46')
    expect(engine.cursor, 'clear-in-place, so the caret does not move').toBe(0)
  })

  it('does nothing at tile 0 of an empty row, and reports itself disabled', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')

    expect(engine.cursor).toBe(0)
    expect(engine.canDelete, 'nothing to clear and nowhere to go back to').toBe(false)

    engine.deleteAtCursorOrBackspace()

    expect(rowPattern(engine)).toBe('________')
    expect(engine.cursor).toBe(0)
  })

  it('is disabled at tile 0 when the row is filled only to the RIGHT of the caret', () => {
    // The old `filledCount > 0` rule called this enabled; both branches are
    // no-ops here, so the button would have looked live and done nothing.
    const engine = new GameEngine(stubRules({}), '12+34=46')
    engine.moveCursor(4)
    type(engine, '99')
    engine.moveCursor(0)

    expect(rowPattern(engine)).toBe('____99__')
    expect(engine.canDelete).toBe(false)
  })

  it('is enabled on an empty tile past 0, where the backspace fallback still acts', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    engine.moveCursor(5)

    expect(engine.canDelete).toBe(true)
    engine.deleteAtCursorOrBackspace()
    expect(engine.cursor, 'the caret moved onto the tile it cleared').toBe(4)
  })

  it('is disabled, and does nothing, once the game is over', () => {
    const engine = new GameEngine(stubRules({ accept: ['12+34=46'] }), '12+34=46')
    type(engine, '12+34=46')
    engine.submit()
    expect(engine.status).toBe('won')

    expect(engine.canDelete).toBe(false)
    engine.deleteAtCursorOrBackspace()
    expect(rowPattern(engine), 'a submitted row is not editable').toBe('12+34=46')
  })

  it('leaves the physical Delete key strict — clearAtCursor never backspaces', () => {
    const engine = new GameEngine(stubRules({}), '12+34=46')
    type(engine, '12+34=46')

    engine.moveCursor(3)
    engine.clearAtCursor()
    engine.clearAtCursor()

    expect(rowPattern(engine), 'the second press has nothing to clear').toBe('12+_4=46')
    expect(engine.cursor, 'and strict clear never moves the caret').toBe(3)
  })
})
