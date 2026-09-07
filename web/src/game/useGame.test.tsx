/**
 * @vitest-environment jsdom
 *
 * The hook is the seam between the pure engine and React. The engine itself is
 * covered by engine.test.ts; what is tested here is the wiring the UI depends
 * on — error identity, target concealment, and whether a finished game is
 * actually written to storage.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGame } from './useGame'
import { createStatsStore } from './storage'
import type { EquationRules } from './engine'
import type { StorageLike } from './storage'
import type { Row } from './types'

/** Accepts only the strings given; rejects everything else with a fixed reason. */
const stubRules = (accept: readonly string[], reason = 'Nope.'): EquationRules => ({
  generate: () => '12+34=46',
  validate: (guess) => (accept.includes(guess) ? { ok: true } : { ok: false, reason }),
  isCommutativelyEquivalent: (a, b) =>
    a === b || (a === '34+12=46' && b === '12+34=46') || (a === '12+34=46' && b === '34+12=46'),
})

/** In-memory StorageLike so tests never touch the real localStorage. */
function memoryBackend(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v) },
    removeItem: (k) => { map.delete(k) },
  }
}

const type = (result: { current: { onKeyPress: (c: string) => void } }, text: string) => {
  act(() => { for (const c of text) result.current.onKeyPress(c) })
}

describe('useGame', () => {
  let store: ReturnType<typeof createStatsStore>

  beforeEach(() => { store = createStatsStore(memoryBackend()) })

  it('fills the active row and only allows submit at eight characters', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34')
    expect(result.current.state.currentInput).toBe('12+34')
    expect(result.current.state.canSubmit).toBe(false)

    type(result, '=46')
    expect(result.current.state.canSubmit).toBe(true)
  })

  it('does not consume a guess when the equation is rejected', () => {
    const { result } = renderHook(() =>
      useGame({ rules: stubRules([], '51+21=42 — the left side equals 72'), store }),
    )

    type(result, '51+21=42')
    act(() => { result.current.onSubmit() })

    expect(result.current.state.errorMessage).toBe('51+21=42 — the left side equals 72')
    expect(result.current.state.guessesUsed).toBe(0)
    expect(result.current.state.currentRow).toBe(0)
    // The row stays editable in place.
    expect(result.current.state.currentInput).toBe('51+21=42')
  })

  it('gives each rejection a fresh errorId so an identical message re-shakes', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '11111111')
    act(() => { result.current.onSubmit() })
    const first = result.current.state.errorId

    act(() => { result.current.onErrorShown() })
    expect(result.current.state.errorMessage).toBeNull()

    act(() => { result.current.onSubmit() })
    expect(result.current.state.errorId).toBeGreaterThan(first)
  })

  it('hides the target until the game is over', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules(['12+34=46']), store }))

    expect(result.current.state.target).toBeNull()

    type(result, '12+34=46')
    act(() => { result.current.onSubmit() })

    expect(result.current.state.status).toBe('won')
    expect(result.current.state.target).toBe('12+34=46')
  })

  it('records a finished game to the stats store', () => {
    const { result } = renderHook(() =>
      useGame({ rules: stubRules(['12+34=46']), store, now: () => 1_700_000_000_000 }),
    )

    expect(store.getRecords()).toHaveLength(0)

    type(result, '12+34=46')
    act(() => { result.current.onSubmit() })

    const records = store.getRecords()
    expect(records).toHaveLength(1)
    expect(records[0]?.won).toBe(true)
    expect(records[0]?.guessesUsed).toBe(1)
    expect(records[0]?.timestampMillis).toBe(1_700_000_000_000)
  })

  it('counts a commutative win even though the tiles are not all green', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules(['34+12=46']), store }))

    type(result, '34+12=46')
    act(() => { result.current.onSubmit() })

    expect(result.current.state.status).toBe('won')
    const row = result.current.state.rows[0]
    expect(row?.tiles.every((t) => t.state === 'correct')).toBe(false)
  })

  it('starts a fresh board on new game and does not record the abandoned one', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12345678')
    act(() => { result.current.onNewGame() })

    expect(result.current.state.currentInput).toBe('')
    expect(result.current.state.guessesUsed).toBe(0)
    expect(result.current.state.status).toBe('in-progress')
    expect(store.getRecords()).toHaveLength(0)
  })
})

describe('useGame — free cursor', () => {
  let store: ReturnType<typeof createStatsStore>

  beforeEach(() => { store = createStatsStore(memoryBackend()) })

  /** Active row rendered with `_` for a gap, so holes are visible in assertions. */
  const pattern = (state: { rows: readonly Row[]; currentRow: number }, index?: number): string => {
    const row = state.rows[index ?? state.currentRow]
    return row === undefined ? '' : row.tiles.map((t) => t.char ?? '_').join('')
  }

  it('exposes the cursor and starts it on the first tile', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    expect(result.current.state.cursor).toBe(0)
    expect(result.current.state.filledCount).toBe(0)
    expect(result.current.state.currentEquation).toBeNull()
  })

  it('types at a clicked tile, leaving earlier tiles empty and Enter disabled', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    act(() => { result.current.onMoveCursor(5) })
    type(result, '7')

    expect(pattern(result.current.state)).toBe('_____7__')
    expect(result.current.state.cursor).toBe(6)
    expect(result.current.state.filledCount).toBe(1)
    expect(result.current.state.canSubmit, 'a row with holes is not submittable').toBe(false)
    expect(result.current.state.currentEquation).toBeNull()
  })

  it('does not derive canSubmit from the length of currentInput', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34=46')
    act(() => { result.current.onMoveCursor(1); result.current.onDeleteAtCursor() })

    // Eight characters were typed and only one removed, but the row now has a
    // hole: currentInput reads as seven characters and Enter must be off.
    expect(pattern(result.current.state)).toBe('1_+34=46')
    expect(result.current.state.currentInput).toBe('1+34=46')
    expect(result.current.state.currentEquation).toBeNull()
    expect(result.current.state.canSubmit).toBe(false)
  })

  it('rejects a row with a hole with the fill-all message and spends no guess', () => {
    const { result } = renderHook(() =>
      useGame({ rules: stubRules(['1+34=46', '12+34=46']), store }),
    )

    type(result, '12+34=46')
    act(() => { result.current.onMoveCursor(1); result.current.onDeleteAtCursor() })
    act(() => { result.current.onSubmit() })

    expect(result.current.state.errorMessage).toBe('Fill all 8 tiles — 1 to go.')
    expect(result.current.state.guessesUsed).toBe(0)
    expect(result.current.state.currentRow).toBe(0)
    expect(result.current.state.status).toBe('in-progress')
    expect(pattern(result.current.state), 'the row survives the rejection').toBe('1_+34=46')
    expect(store.getRecords()).toHaveLength(0)
  })

  it('overwrites in the middle without disturbing the neighbours', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34=46')
    act(() => { result.current.onMoveCursor(3) })
    type(result, '9')

    expect(pattern(result.current.state)).toBe('12+94=46')
    expect(result.current.state.cursor).toBe(4)
    expect(result.current.state.canSubmit).toBe(true)
    expect(result.current.state.currentEquation).toBe('12+94=46')
  })

  it('moves the cursor with backspace and leaves it with delete', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34=46')

    act(() => { result.current.onMoveCursor(4); result.current.onDelete() })
    expect(pattern(result.current.state)).toBe('12+_4=46')
    expect(result.current.state.cursor).toBe(3)

    act(() => { result.current.onMoveCursor(6); result.current.onDeleteAtCursor() })
    expect(pattern(result.current.state)).toBe('12+_4=_6')
    expect(result.current.state.cursor, 'Delete does not move the caret').toBe(6)
  })

  it('backspaces the last tile of a full row via the keypad backspace', () => {
    // The common path: the player fills the row, then hits the keypad's backspace
    // to fix the final character. It must clear tile 7, not tile 6.
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34=46')
    act(() => { result.current.onDelete() })

    expect(pattern(result.current.state)).toBe('12+34=4_')
    expect(result.current.state.cursor).toBe(7)
    expect(result.current.state.canSubmit).toBe(false)

    type(result, '6')
    expect(pattern(result.current.state)).toBe('12+34=46')
    expect(result.current.state.canSubmit).toBe(true)
  })

  it('backspace at the first tile clears it and stays', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34=46')
    act(() => { result.current.onMoveCursor(0); result.current.onDelete() })

    expect(pattern(result.current.state)).toBe('_2+34=46')
    expect(result.current.state.cursor).toBe(0)
  })

  it('clears the caret tile in place via the on-screen DELETE, then retypes there', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34=46')
    act(() => { result.current.onMoveCursor(3) })
    expect(result.current.state.canDelete).toBe(true)

    act(() => { result.current.onDeleteAtCursorOrBackspace() })
    expect(pattern(result.current.state), 'neighbours untouched').toBe('12+_4=46')
    expect(result.current.state.cursor, 'the caret stays put').toBe(3)

    type(result, '9')
    expect(pattern(result.current.state)).toBe('12+94=46')
  })

  it('backspaces via the on-screen DELETE when the caret tile is empty', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34=46')
    act(() => { result.current.onMoveCursor(3); result.current.onDeleteAtCursorOrBackspace() })
    act(() => { result.current.onDeleteAtCursorOrBackspace() })

    expect(pattern(result.current.state)).toBe('12__4=46')
    expect(result.current.state.cursor).toBe(2)
  })

  it('empties the row under repeated on-screen DELETE presses, then reports disabled', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '12+34=46')

    for (let i = 0; i < 8; i++) {
      expect(result.current.state.canDelete, `press ${i + 1} is enabled`).toBe(true)
      act(() => { result.current.onDeleteAtCursorOrBackspace() })
    }

    expect(pattern(result.current.state)).toBe('________')
    expect(result.current.state.cursor).toBe(0)
    expect(result.current.state.canDelete, 'nothing left to delete').toBe(false)

    // And a further press is a no-op rather than a crash.
    act(() => { result.current.onDeleteAtCursorOrBackspace() })
    expect(pattern(result.current.state)).toBe('________')
  })

  it('reports canDelete from the caret, not from how full the row is', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    // Empty row, caret at 0: both branches are no-ops.
    expect(result.current.state.canDelete).toBe(false)

    // Characters only to the RIGHT of a caret parked at 0: still nothing to do,
    // even though filledCount is 2.
    act(() => { result.current.onMoveCursor(4) })
    type(result, '99')
    act(() => { result.current.onMoveCursor(0) })
    expect(result.current.state.filledCount).toBe(2)
    expect(result.current.state.canDelete).toBe(false)

    // Tile 0 filled, caret at 0: enabled, and it clears in place.
    type(result, '7')
    act(() => { result.current.onMoveCursor(0) })
    expect(result.current.state.canDelete).toBe(true)
    act(() => { result.current.onDeleteAtCursorOrBackspace() })
    expect(pattern(result.current.state)).toBe('____99__')
    expect(result.current.state.cursor).toBe(0)
  })

  it('turns canDelete off once the game is over', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules(['12+34=46']), store }))

    type(result, '12+34=46')
    expect(result.current.state.canDelete).toBe(true)

    act(() => { result.current.onSubmit() })
    expect(result.current.state.status).toBe('won')
    expect(result.current.state.canDelete).toBe(false)
  })

  it('clamps the arrow keys at both ends', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    act(() => { result.current.onCursorLeft() })
    expect(result.current.state.cursor).toBe(0)

    act(() => { for (let i = 0; i < 20; i++) result.current.onCursorRight() })
    expect(result.current.state.cursor).toBe(7)

    act(() => { result.current.onCursorLeft() })
    expect(result.current.state.cursor).toBe(6)
  })

  it('stops the cursor at the last tile instead of wrapping', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules([]), store }))

    type(result, '123456789')

    expect(result.current.state.cursor).toBe(7)
    expect(pattern(result.current.state), 'the ninth key overwrote tile 7').toBe('12345679')
  })

  it('resets the cursor to 0 after a valid submit and on a new game', () => {
    const { result } = renderHook(() => useGame({ rules: stubRules(['11+11=22']), store }))

    type(result, '11+11=22')
    expect(result.current.state.cursor).toBe(7)

    act(() => { result.current.onSubmit() })
    expect(result.current.state.currentRow).toBe(1)
    expect(result.current.state.cursor).toBe(0)

    act(() => { result.current.onMoveCursor(6) })
    expect(result.current.state.cursor).toBe(6)

    act(() => { result.current.onNewGame() })
    expect(result.current.state.cursor).toBe(0)
    expect(result.current.state.currentInput).toBe('')
    expect(result.current.state.canSubmit).toBe(false)
  })
})
