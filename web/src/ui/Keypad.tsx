import { useEffect } from 'react'
import type { TileState } from '../game/types'
import { spokenChar } from './strings'
import './Keypad.css'

const ROW_ONE: readonly string[] = ['1', '2', '3', '4', '5']
const ROW_TWO: readonly string[] = ['6', '7', '8', '9', '0']
const ROW_THREE: readonly string[] = ['+', '-', '*', '/', '=']

const CHAR_ROWS: readonly (readonly string[])[] = [ROW_ONE, ROW_TWO, ROW_THREE]

/** Physical-keyboard aliases: `x` and `X` are the natural way to type a times. */
const KEY_ALIASES: Readonly<Record<string, string>> = {
  x: '*',
  X: '*',
}

const ENTERABLE: readonly string[] = [...ROW_ONE, ...ROW_TWO, ...ROW_THREE]

function stateWord(state: TileState): string {
  switch (state) {
    case 'correct':
      return 'known correct position'
    case 'present':
      return 'in the equation, position unknown'
    case 'absent':
      return 'eliminated'
    case 'empty':
    case 'filled':
      return 'not yet tried'
  }
}

export interface KeypadProps {
  /** Best-known state per character. Missing entries read as untried. */
  readonly keyStates: Readonly<Record<string, TileState>>
  readonly onKeyPress: (char: string) => void
  /** Backspace: clears the tile before the caret and moves there. */
  readonly onDelete: () => void
  /**
   * Forward delete: clears the tile *at* the caret and leaves it put. Wire it
   * to the hook's `onDeleteAtCursor`. Omit it and the physical Delete key falls
   * back to behaving like Backspace, which is what it did before the caret
   * existed.
   */
  readonly onDeleteAtCursor?: () => void
  /**
   * What the on-screen DELETE button does: clear the tile the caret is *on*,
   * leaving the caret put so the player can type a replacement, and fall back
   * to a backspace when that tile is already empty. That hybrid lives in the
   * engine, not here — this is just the handler for it.
   *
   * Omit it and the button falls back to `onDeleteAtCursor`, then to
   * `onDelete`. The physical Backspace key is deliberately unaffected either
   * way: backspace means "delete backwards" on every keyboard on earth.
   */
  readonly onDeleteAtSelection?: () => void
  /**
   * ArrowLeft / ArrowRight on a physical keyboard. Omit it and the arrows are
   * left to the browser.
   */
  readonly onArrow?: (direction: 'left' | 'right') => void
  readonly onSubmit: () => void
  /** False once all eight tiles are not yet filled, or the game is over. */
  readonly canSubmit?: boolean
  /** Enables the physical Backspace / Delete keys. */
  readonly canDelete?: boolean
  /**
   * Enables the on-screen DELETE button, whose reach is wider than
   * `canDelete`'s: it is live whenever *either* branch of the hybrid would do
   * something — the caret's tile is filled, or there is something to its left.
   * Falls back to `canDelete` when not supplied.
   */
  readonly canDeleteAtSelection?: boolean
  /** False when the game is over: the pad greys out but stays readable. */
  readonly enabled?: boolean
  /**
   * Listen on `window` for a physical keyboard. On by default; turn it off
   * when the pad is behind a drawer or another screen so the two do not fight.
   */
  readonly keyboardEnabled?: boolean
}

export function Keypad({
  keyStates,
  onKeyPress,
  onDelete,
  onDeleteAtCursor,
  onDeleteAtSelection,
  onArrow,
  onSubmit,
  canSubmit = true,
  canDelete = true,
  canDeleteAtSelection,
  enabled = true,
  keyboardEnabled = true,
}: KeypadProps) {
  /**
   * Physical keyboard. Digits and operators type, Enter submits, Backspace and
   * Delete rub out, and the arrows walk the caret along the active row.
   * Modifier chords are left alone so browser shortcuts keep working, and
   * Enter / Space are ignored while a button has focus — the browser is
   * already turning those into a click on that button.
   */
  useEffect(() => {
    if (!keyboardEnabled || !enabled) return

    const handler = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const active = document.activeElement
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      const key = event.key

      if (key === 'Enter') {
        // The browser already turns Enter into a click on whichever button has
        // focus. Defer to it ONLY when that button is this Enter key. Deferring
        // for any focused button was a bug: tapping a digit leaves that digit
        // focused, after which Enter would silently re-enter the digit instead
        // of submitting the guess.
        if (active instanceof HTMLElement && active.dataset['ndAction'] === 'submit') return
        event.preventDefault()
        if (canSubmit) onSubmit()
        return
      }
      if (key === 'Backspace') {
        event.preventDefault()
        if (canDelete) onDelete()
        return
      }
      if (key === 'Delete') {
        event.preventDefault()
        // Delete clears the tile under the caret; Backspace clears the one
        // before it. Without a handler for the former, both mean Backspace.
        if (canDelete) (onDeleteAtCursor ?? onDelete)()
        return
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        if (onArrow === undefined) return
        // Swallowed so the arrows drive the caret rather than scrolling the page.
        event.preventDefault()
        onArrow(key === 'ArrowLeft' ? 'left' : 'right')
        return
      }

      const mapped = KEY_ALIASES[key] ?? key
      if (ENTERABLE.includes(mapped)) {
        event.preventDefault()
        onKeyPress(mapped)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [
    keyboardEnabled,
    enabled,
    canSubmit,
    canDelete,
    onKeyPress,
    onDelete,
    onDeleteAtCursor,
    onArrow,
    onSubmit,
  ])

  // The on-screen button and the physical keys have diverged on purpose: the
  // button clears the selected tile, Backspace still deletes backwards.
  const deleteButton = onDeleteAtSelection ?? onDeleteAtCursor ?? onDelete
  const deleteButtonEnabled = canDeleteAtSelection ?? canDelete

  return (
    <div className="nd-keypad" aria-label="Keypad" role="group">
      {CHAR_ROWS.map((keys, rowIndex) => (
        <div className="nd-keypad__row" key={rowIndex}>
          {keys.map((char) => {
            const state: TileState = keyStates[char] ?? 'empty'
            return (
              <button
                key={char}
                type="button"
                className={`nd-key nd-key--${state}`}
                aria-label={`${spokenChar(char)}, ${stateWord(state)}`}
                disabled={!enabled}
                onClick={() => onKeyPress(char)}
              >
                <span aria-hidden="true">{char}</span>
              </button>
            )
          })}
        </div>
      ))}

      <div className="nd-keypad__row">
        <button
          type="button"
          className="nd-key nd-key--action nd-key--delete"
          aria-label="Delete, clears the selected tile"
          disabled={!enabled || !deleteButtonEnabled}
          onClick={deleteButton}
        >
          <span aria-hidden="true">DELETE</span>
        </button>
        <button
          type="button"
          className="nd-key nd-key--action nd-key--enter"
          data-nd-action="submit"
          aria-label={
            canSubmit
              ? 'Enter, submit this guess'
              : 'Enter, unavailable until all eight tiles are filled'
          }
          disabled={!enabled || !canSubmit}
          onClick={onSubmit}
        >
          <span aria-hidden="true">ENTER</span>
        </button>
      </div>
    </div>
  )
}
