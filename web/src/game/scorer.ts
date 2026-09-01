/**
 * Tile colouring for a submitted guess.
 *
 * Pure TypeScript — no React, no DOM, no clock. Safe to unit test in `node`.
 * Ported from the Android build's `logic/Scorer.kt`; keep the two in step.
 *
 * The rule is the Wordle rule, applied uniformly to digits, operators and `=`:
 * **two passes over the row, with a per-character budget drawn from the target.**
 *
 *  - Pass 1 walks every position and marks the exact positional matches `correct`,
 *    consuming one unit of that character's budget.
 *  - Pass 2 walks the leftovers. A character is `present` only while budget that
 *    survived pass 1 remains; once that budget is exhausted the remaining copies
 *    are `absent`.
 *
 * The ordering is load-bearing. A one-pass `target.includes(c)` test scores
 * duplicates wrong in both directions: it over-colours a guess that repeats a
 * character the target holds only once, and it steals budget from a later
 * positional match. Worked example — target `12+34=46`, guess `44+11=55`:
 * the target holds two `4`s (positions 4 and 6) but only one `1`, so both
 * guessed `4`s come back PRESENT while the *second* guessed `1` comes back
 * ABSENT. Result: `P P G P - G - -`.
 */

import { TILE_STATE_RANK } from './types'
import type { Tile, TileState } from './types'

/**
 * Scores `guess` against `target`. Both must be the same length; in this game
 * that is always `EQUATION_LENGTH`.
 *
 * @returns one Tile per character of `guess`, each carrying that character and a
 *   state of `correct`, `present` or `absent`. Never `empty` or `filled`.
 */
export function score(guess: string, target: string): Tile[] {
  if (guess.length !== target.length) {
    throw new Error(
      `score() needs equal lengths: guess='${guess}' (${guess.length}) ` +
        `target='${target}' (${target.length})`,
    )
  }

  const chars = [...guess]
  const targetChars = [...target]
  const states: (TileState | null)[] = chars.map(() => null)

  // Remaining, unconsumed occurrences of each character in the target.
  const remaining = new Map<string, number>()
  for (const c of targetChars) remaining.set(c, (remaining.get(c) ?? 0) + 1)

  // Pass 1 — exact positional matches claim their budget before anything else.
  for (let i = 0; i < chars.length; i++) {
    const g = chars[i]
    if (g !== undefined && g === targetChars[i]) {
      states[i] = 'correct'
      remaining.set(g, (remaining.get(g) ?? 0) - 1)
    }
  }

  // Pass 2 — misplaced characters draw only on the budget pass 1 left behind.
  for (let i = 0; i < chars.length; i++) {
    if (states[i] !== null) continue
    const c = chars[i]
    if (c === undefined) continue
    const left = remaining.get(c) ?? 0
    if (left > 0) {
      states[i] = 'present'
      remaining.set(c, left - 1)
    } else {
      states[i] = 'absent'
    }
  }

  return chars.map((c, i) => ({ char: c, state: states[i] ?? 'absent' }))
}

/**
 * Folds a freshly scored row into the keypad colouring.
 *
 * Monotonic by construction: a key's state may only ever improve along
 * absent -> present -> correct (see `TILE_STATE_RANK`) and never regresses.
 * Without this, a later guess that puts a known-green character in the wrong
 * column would downgrade its key from green to purple and mislead the player.
 *
 * @returns a new object; `current` is not mutated.
 */
export function updateKeypad(
  current: Readonly<Record<string, TileState>>,
  tiles: readonly Tile[],
): Record<string, TileState> {
  const next: Record<string, TileState> = { ...current }
  for (const tile of tiles) {
    const c = tile.char
    if (c === null) continue
    const existing = next[c]
    if (existing === undefined || TILE_STATE_RANK[tile.state] > TILE_STATE_RANK[existing]) {
      next[c] = tile.state
    }
  }
  return next
}
