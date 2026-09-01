/**
 * The Nerdier game state machine.
 *
 * Pure TypeScript: no React imports, no DOM, no `localStorage`, no clock.
 * Single-threaded by contract — the `useGame` hook is its only caller.
 * Ported from the Android build's `logic/GameEngine.kt`; keep the two in step.
 */

import {
  ALL_CHARS,
  EQUATION_LENGTH,
  MAX_GUESSES,
  clampCursor,
  emptyRow,
  emptyTile,
  filledCount,
  rowEquation,
} from './types'
import type { GameStatus, GuessResult, Row, Tile, TileState, ValidationResult } from './types'
import { score, updateKeypad } from './scorer'

/**
 * Arithmetic rules the engine depends on.
 *
 * This is a thin seam over the math-wizard's `equation.ts`, not a second
 * implementation of it. It exists so `GameEngine` can be unit tested with a stub
 * in a plain `node` environment, and so the whole engine has exactly one place
 * that touches the arithmetic module.
 *
 * The production binding lives in `useGame.ts` (`realEquationRules`) — that keeps
 * this file free of any import of `equation.ts`, so the engine's tests never drag
 * the arithmetic in.
 */
export interface EquationRules {
  generate(rng?: () => number): string
  validate(guess: string): ValidationResult
  isCommutativelyEquivalent(a: string, b: string): boolean
}

/** Immutable read-only view of the board, handed up to the hook. */
export interface EngineSnapshot {
  readonly rows: readonly Row[]
  readonly currentRow: number
  /** Caret position within the active row, 0..EQUATION_LENGTH-1. */
  readonly cursor: number
  readonly keypad: Readonly<Record<string, TileState>>
  readonly status: GameStatus
  readonly guessesUsed: number
}

const ALL_CHARS_SET: ReadonlySet<string> = new Set(ALL_CHARS)

export class GameEngine {
  /** The 8-character answer. Never revealed to the UI while the game is live. */
  readonly target: string

  private readonly rules: EquationRules
  private readonly rows: Row[]

  /** Index of the row currently being typed. Equals `MAX_GUESSES` once the board is full. */
  private currentRowIndex = 0
  /**
   * Caret position within the active row, always 0..EQUATION_LENGTH-1.
   *
   * Crossword-style entry: the player may put the caret anywhere in the active
   * row, so the row is NOT a contiguous string and may hold gaps at any time.
   * Reset to 0 when a row is consumed and when a new game starts.
   */
  private cursorIndex = 0
  private keypadState: Record<string, TileState> = {}
  private gameStatus: GameStatus = 'in-progress'
  /** Rows actually consumed. Invalid submissions never increment this. */
  private guesses = 0

  /**
   * @param rules arithmetic seam; inject a stub in tests.
   * @param target the 8-character answer. Defaults to a freshly generated equation.
   * @param rng passed through to `rules.generate` when a target is generated.
   */
  constructor(rules: EquationRules, target?: string, rng?: () => number) {
    this.rules = rules
    const answer = target ?? rules.generate(rng)
    if (answer.length !== EQUATION_LENGTH) {
      throw new Error(
        `target must be ${EQUATION_LENGTH} characters, was '${answer}' (${answer.length})`,
      )
    }
    this.target = answer
    this.rows = Array.from({ length: MAX_GUESSES }, emptyRow)
  }

  get currentRow(): number {
    return this.currentRowIndex
  }

  /** Caret position within the active row, 0..EQUATION_LENGTH-1. */
  get cursor(): number {
    return this.cursorIndex
  }

  get keypad(): Readonly<Record<string, TileState>> {
    return this.keypadState
  }

  get status(): GameStatus {
    return this.gameStatus
  }

  get guessesUsed(): number {
    return this.guesses
  }

  snapshot(): EngineSnapshot {
    return {
      rows: [...this.rows],
      currentRow: this.currentRowIndex,
      cursor: this.cursorIndex,
      keypad: this.keypadState,
      status: this.gameStatus,
      guessesUsed: this.guesses,
    }
  }

  /** True while the player may still type into a row. */
  private get editable(): boolean {
    return this.gameStatus === 'in-progress' && this.currentRowIndex < this.rows.length
  }

  /** The active row, or `undefined` once the board is full. */
  private activeRow(): Row | undefined {
    return this.rows[this.currentRowIndex]
  }

  /**
   * Moves the caret to `index`, clamped into range. Ignored once the game is
   * over — clicking a tile in a submitted row must do nothing.
   */
  moveCursor(index: number): void {
    if (!this.editable) return
    this.cursorIndex = clampCursor(index)
  }

  /** ArrowLeft. Clamped at 0. */
  moveCursorLeft(): void {
    this.moveCursor(this.cursorIndex - 1)
  }

  /** ArrowRight. Clamped at EQUATION_LENGTH - 1. */
  moveCursorRight(): void {
    this.moveCursor(this.cursorIndex + 1)
  }

  /**
   * Writes `c` at the caret, **overwriting** whatever was there, then advances
   * the caret by one, stopping at the last tile — it does not wrap. Ignored when
   * the game is over or `c` is not a key the player actually has.
   */
  keyPress(c: string): void {
    if (!this.editable) return
    if (!ALL_CHARS_SET.has(c)) return

    this.setTile(this.cursorIndex, { char: c, state: 'filled' })
    // Stop at the last tile rather than wrapping: a ninth keypress overwrites
    // tile 7 instead of silently clobbering tile 0.
    this.cursorIndex = clampCursor(this.cursorIndex + 1)
  }

  /**
   * Backspace: clears the tile *before* the caret and moves there. At the first
   * tile there is nowhere to go back to, so it clears tile 0 and stays.
   *
   * One exception, at the far end. The caret stops ON the last tile rather than
   * running off it, so on a full row the plain leftward rule would clear tile 6
   * and strand tile 7 — the final character of a full row could never be
   * backspaced away. When the caret is on the last tile AND that tile holds a
   * character, backspace therefore clears *that* tile and stays put, which is
   * what a text input does when the caret sits at the end of the text. The
   * second backspace finds tile 7 empty and falls through to the normal rule,
   * clearing tile 6 and moving there.
   */
  backspace(): void {
    if (!this.editable) return

    const atLastTile = this.cursorIndex === EQUATION_LENGTH - 1
    const lastTileFilled = this.activeRow()?.tiles[this.cursorIndex]?.char != null
    if (atLastTile && lastTileFilled) {
      this.setTile(this.cursorIndex, emptyTile())
      return
    }

    const target = this.cursorIndex === 0 ? 0 : this.cursorIndex - 1
    this.setTile(target, emptyTile())
    this.cursorIndex = target
  }

  /**
   * Backspace under its historical name. The keypad's ⌫ button and the physical
   * Backspace key both land here; `backspace()` is the same call.
   */
  delete(): void {
    this.backspace()
  }

  /** Delete key: clears the tile *at* the caret and leaves the caret where it is. */
  clearAtCursor(): void {
    if (!this.editable) return
    this.setTile(this.cursorIndex, emptyTile())
  }

  /** Replaces a single tile of the active row. Only ever touches the active row. */
  private setTile(index: number, tile: Tile): void {
    const row = this.activeRow()
    if (row === undefined) return
    const tiles = [...row.tiles]
    tiles[clampCursor(index)] = tile
    this.rows[this.currentRowIndex] = { tiles }
  }

  /**
   * Submits the active row.
   *
   * - Game already over -> `{ ok: false }`, nothing changes.
   * - Any tile still empty -> `{ ok: false }`; the row is NOT consumed and no
   *   guess is spent. Gaps count: `1_+34=46` is incomplete, not a 7-character
   *   guess.
   * - Rejected by `rules.validate` -> `{ ok: false }` carrying the validator's
   *   reason **verbatim**; the row is NOT consumed and no guess is spent. The
   *   player edits in place and resubmits.
   * - Accepted -> the row is scored, consumed, and the win check runs.
   */
  submit(): GuessResult {
    if (this.gameStatus !== 'in-progress') {
      return { ok: false, reason: 'This game is over. Start a new game to keep playing.' }
    }
    if (this.currentRowIndex >= this.rows.length) {
      return { ok: false, reason: 'No guesses left.' }
    }

    const row = this.activeRow()
    // rowEquation is the ONLY safe source for a guess: it returns null unless
    // every position is filled, so a row with holes can never be silently
    // compacted into a shorter (or differently ordered) equation. Never build a
    // guess from `rowText`, which skips gaps.
    const guess = row === undefined ? null : rowEquation(row)
    if (guess === null) {
      const missing = EQUATION_LENGTH - (row === undefined ? 0 : filledCount(row))
      return { ok: false, reason: `Fill all ${EQUATION_LENGTH} tiles — ${missing} to go.` }
    }

    const validation = this.rules.validate(guess)
    if (!validation.ok) {
      // Surfaced verbatim: the math-wizard writes the player-facing wording.
      return { ok: false, reason: validation.reason }
    }

    const tiles = score(guess, this.target)

    // WIN TEST — deliberately independent of the tile colours.
    //
    // A commutative win (guess `34+12=46` against target `12+34=46`) is a win
    // even though several of its tiles score `present` rather than `correct`.
    // Inferring `won` from "every tile is correct" would call that a miss, so the
    // decision is delegated to the arithmetic layer and never re-derived from
    // `tiles`. Do not "simplify" this to a `tiles.every(t => t.state ===
    // 'correct')` check.
    const won = guess === this.target || this.rules.isCommutativelyEquivalent(guess, this.target)

    // Consume the row.
    this.rows[this.currentRowIndex] = { tiles }
    this.keypadState = updateKeypad(this.keypadState, tiles)
    this.currentRowIndex += 1
    this.guesses += 1
    // A new row starts with the caret back at the first tile.
    this.cursorIndex = 0

    this.gameStatus = won ? 'won' : this.guesses >= MAX_GUESSES ? 'lost' : 'in-progress'

    return { ok: true, tiles, won }
  }
}
