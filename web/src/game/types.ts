/**
 * Shared vocabulary for Nerdier. Owned by the senior developer.
 * Ported from the Android build's `model/Model.kt` — keep the two in step.
 */

/** Every equation — target and guess alike — is exactly this many tiles. */
export const EQUATION_LENGTH = 8

/** The player gets this many submitted guesses. Invalid submissions do not count. */
export const MAX_GUESSES = 6

export const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
export const OPERATORS = ['+', '-', '*', '/'] as const
export const EQUALS = '=' as const
export const ALL_CHARS: readonly string[] = [...DIGITS, ...OPERATORS, EQUALS]

/**
 * Colour semantics for a single tile.
 *
 * - `empty`   — nothing typed yet.
 * - `filled`  — typed but not submitted; no information revealed.
 * - `correct` — right character, right position (green).
 * - `present` — character occurs in the target but not here (purple).
 * - `absent`  — character does not occur in the target, or its occurrences are
 *               already accounted for by correct/present tiles elsewhere (black).
 */
export type TileState = 'empty' | 'filled' | 'correct' | 'present' | 'absent'

/** Ranking used to upgrade keypad colours monotonically; higher never downgrades. */
export const TILE_STATE_RANK: Record<TileState, number> = {
  empty: 0,
  filled: 1,
  absent: 2,
  present: 3,
  correct: 4,
}

export interface Tile {
  readonly char: string | null
  readonly state: TileState
}

/** A single board row: always EQUATION_LENGTH tiles. */
export interface Row {
  readonly tiles: readonly Tile[]
}

export type GameStatus = 'in-progress' | 'won' | 'lost'

/** Result of validating a candidate equation string. */
export type ValidationResult =
  | { readonly ok: true }
  /** `reason` is shown verbatim to the player, so make it specific. */
  | { readonly ok: false; readonly reason: string }

/** Outcome of submitting a full row. */
export type GuessResult =
  | { readonly ok: true; readonly tiles: readonly Tile[]; readonly won: boolean }
  | { readonly ok: false; readonly reason: string }

export const emptyTile = (): Tile => ({ char: null, state: 'empty' })

export const emptyRow = (): Row => ({
  tiles: Array.from({ length: EQUATION_LENGTH }, emptyTile),
})

export const emptyBoard = (): Row[] => Array.from({ length: MAX_GUESSES }, emptyRow)

/**
 * Characters typed into a row so far, with gaps skipped.
 *
 * **Display and diagnostics only — never submit this.** The player may type at
 * any position, so a partially filled row can hold holes, and skipping them
 * would silently build a different equation from the one on screen. Use
 * [rowEquation] to get something submittable.
 */
export const rowText = (row: Row): string =>
  row.tiles.map((t) => t.char).filter((c): c is string => c !== null).join('')

/** How many positions hold a character. Gaps are allowed while typing. */
export const filledCount = (row: Row): number =>
  row.tiles.reduce((n, t) => (t.char === null ? n : n + 1), 0)

/** True once every position holds a character, so the row can be submitted. */
export const isRowComplete = (row: Row): boolean => row.tiles.every((t) => t.char !== null)

/**
 * The full EQUATION_LENGTH-character equation, or `null` while the row still has
 * gaps. This is the only safe source for a guess.
 */
export const rowEquation = (row: Row): string | null =>
  isRowComplete(row) ? row.tiles.map((t) => t.char ?? '').join('') : null

/** Cursor position within the active row: 0..EQUATION_LENGTH-1. */
export const clampCursor = (index: number): number =>
  Math.min(Math.max(index, 0), EQUATION_LENGTH - 1)
