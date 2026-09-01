/**
 * The React seam over the game engine — the only file in `src/game` that imports
 * React, and the only one the UI talks to.
 *
 * Ported from the Android build's `logic/GameViewModel.kt`. `GameUiState` is
 * immutable and replaced wholesale on every change; the UI never mutates game
 * state, it calls the intent functions.
 */

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { MAX_GUESSES, emptyRow, filledCount, isRowComplete, rowEquation, rowText } from './types'
import type { GameStatus, Row, TileState, ValidationResult } from './types'
import { GameEngine } from './engine'
import type { EquationRules } from './engine'
import {
  generateEquation,
  isCommutativelyEquivalent as equationsAreEquivalent,
  validateEquation,
} from './equation'
import { summarizeAll } from './stats'
import type { GameRecord, StatsSummaries } from './stats'
import { statsStore } from './storage'
import type { StatsStore } from './storage'

/**
 * The production rules: delegates straight through to the math-wizard's module.
 * This is the one place in the app that binds `equation.ts` to the engine's seam.
 */
export const realEquationRules: EquationRules = {
  generate: (rng?: () => number): string => generateEquation(rng),
  validate: (guess: string): ValidationResult => validateEquation(guess),
  isCommutativelyEquivalent: (a: string, b: string): boolean => equationsAreEquivalent(a, b),
}

/**
 * Everything the board screen needs to draw itself.
 *
 * @property rows all `MAX_GUESSES` rows: consumed ones scored, the active one
 *   filled, the rest empty.
 * @property currentRow index of the row being typed; equals `MAX_GUESSES` once the
 *   board is full.
 * @property keypad per-key colour, upgraded monotonically. Keys missing from the
 *   object have not been guessed yet.
 * @property errorMessage transient, player-facing. The UI shows it then calls
 *   `onErrorShown`.
 * @property errorId increments on every new error, so the UI re-shakes on two
 *   identical messages in a row instead of swallowing the second. Feed it to the
 *   grid's shake trigger together with `currentRow`.
 * @property target the answer — **null until the game is over**, so no screen can
 *   leak it.
 */
export interface GameUiState {
  readonly rows: readonly Row[]
  readonly currentRow: number
  readonly keypad: Readonly<Record<string, TileState>>
  readonly status: GameStatus
  readonly guessesUsed: number
  readonly errorMessage: string | null
  readonly errorId: number
  readonly target: string | null
  readonly isGameOver: boolean
  readonly guessesRemaining: number
  /**
   * Characters typed into the active row so far, **gaps skipped**.
   *
   * Display and diagnostics only. With crossword-style entry the active row may
   * hold holes, so this is not the equation that would be submitted — see
   * `currentEquation` for that.
   */
  readonly currentInput: string
  /**
   * The active row as a submittable equation, or `null` while it still has gaps.
   * This is the string `onSubmit` would actually send to the validator.
   */
  readonly currentEquation: string | null
  /** Caret position in the active row, 0..EQUATION_LENGTH-1. Drives the UI's caret. */
  readonly cursor: number
  /** How many of the active row's eight tiles hold a character. */
  readonly filledCount: number
  /** Enter is only meaningful once *every* tile is filled and the game is live. */
  readonly canSubmit: boolean
  /** Backspace is only meaningful when the active row has something in it. */
  readonly canDelete: boolean
}

export interface UseGameOptions {
  /** Swap the arithmetic out in tests or previews. */
  readonly rules?: EquationRules
  /** Deterministic target generation. */
  readonly rng?: () => number
  /** Pin the clock used to timestamp finished games. */
  readonly now?: () => number
  /** Swap persistence out in tests. */
  readonly store?: StatsStore
}

export interface UseGameResult {
  readonly state: GameUiState
  /** Writes at the caret, overwriting, then advances it (stops at the last tile). */
  readonly onKeyPress: (c: string) => void
  /** Backspace: clears the tile before the caret and moves there; at 0 clears tile 0. */
  readonly onDelete: () => void
  /** Delete: clears the tile at the caret without moving it. */
  readonly onDeleteAtCursor: () => void
  /** Tile click: moves the caret. Clamped, and ignored once the game is over. */
  readonly onMoveCursor: (index: number) => void
  /** ArrowLeft. */
  readonly onCursorLeft: () => void
  /** ArrowRight. */
  readonly onCursorRight: () => void
  readonly onSubmit: () => void
  readonly onNewGame: () => void
  /** Called by the UI once `state.errorMessage` has been displayed. */
  readonly onErrorShown: () => void
}

/** Projects the engine's snapshot into the immutable state the UI renders from. */
function stateFrom(engine: GameEngine, errorMessage: string | null, errorId: number): GameUiState {
  const snapshot = engine.snapshot()
  // Once the board is full there is no active row; an empty stand-in keeps the
  // derived fields total without special-casing every one of them.
  const row = snapshot.rows[snapshot.currentRow] ?? emptyRow()
  const isGameOver = snapshot.status !== 'in-progress'
  return {
    rows: snapshot.rows,
    currentRow: snapshot.currentRow,
    keypad: snapshot.keypad,
    status: snapshot.status,
    guessesUsed: snapshot.guessesUsed,
    errorMessage,
    errorId,
    // Revealed only once the game is over — won or lost.
    target: isGameOver ? engine.target : null,
    isGameOver,
    guessesRemaining: MAX_GUESSES - snapshot.guessesUsed,
    currentInput: rowText(row),
    currentEquation: rowEquation(row),
    cursor: snapshot.cursor,
    filledCount: filledCount(row),
    // Completeness, not length: a row with a hole reads short via `rowText` but
    // must not be submittable, and `isRowComplete` is the only check that sees
    // the gap.
    canSubmit: !isGameOver && isRowComplete(row),
    canDelete: !isGameOver && filledCount(row) > 0,
  }
}

/** Drives one game and records the result. */
export function useGame(options?: UseGameOptions): UseGameResult {
  // Options are read through a ref so the intent callbacks can be stable even when
  // the caller passes fresh object literals every render.
  const optionsRef = useRef<UseGameOptions | undefined>(options)
  optionsRef.current = options

  const newEngine = useCallback((): GameEngine => {
    const o = optionsRef.current
    return new GameEngine(o?.rules ?? realEquationRules, undefined, o?.rng)
  }, [])

  const engineRef = useRef<GameEngine | null>(null)
  if (engineRef.current === null) engineRef.current = newEngine()

  const [state, setState] = useState<GameUiState>(() =>
    stateFrom(engineRef.current ?? newEngine(), null, 0),
  )
  const nextErrorId = useRef(1)

  const publish = useCallback((error: string | null) => {
    const engine = engineRef.current
    if (engine === null) return
    setState((previous) => {
      const errorId = error === null ? previous.errorId : nextErrorId.current++
      return stateFrom(engine, error, errorId)
    })
  }, [])

  const onKeyPress = useCallback(
    (c: string) => {
      engineRef.current?.keyPress(c)
      publish(null)
    },
    [publish],
  )

  const onDelete = useCallback(() => {
    engineRef.current?.backspace()
    publish(null)
  }, [publish])

  const onDeleteAtCursor = useCallback(() => {
    engineRef.current?.clearAtCursor()
    publish(null)
  }, [publish])

  const onMoveCursor = useCallback(
    (index: number) => {
      engineRef.current?.moveCursor(index)
      publish(null)
    },
    [publish],
  )

  const onCursorLeft = useCallback(() => {
    engineRef.current?.moveCursorLeft()
    publish(null)
  }, [publish])

  const onCursorRight = useCallback(() => {
    engineRef.current?.moveCursorRight()
    publish(null)
  }, [publish])

  const onSubmit = useCallback(() => {
    const engine = engineRef.current
    if (engine === null) return

    const statusBefore = engine.status
    const result = engine.submit()

    if (!result.ok) {
      // Row not consumed, no guess spent — just tell the player why.
      publish(result.reason)
      return
    }

    publish(null)

    // The engine decides `won` (identical OR commutatively equivalent); we only
    // read it. Never re-derive it from tile colours here.
    if (statusBefore === 'in-progress' && engine.status !== 'in-progress') {
      const o = optionsRef.current
      const record: GameRecord = {
        timestampMillis: (o?.now ?? Date.now)(),
        won: result.won,
        guessesUsed: engine.guessesUsed,
      }
      ;(o?.store ?? statsStore).record(record)
    }
  }, [publish])

  /** Abandons the current game and deals a new target. An unfinished game is not recorded. */
  const onNewGame = useCallback(() => {
    const engine = newEngine()
    engineRef.current = engine
    setState(stateFrom(engine, null, 0))
  }, [newEngine])

  const onErrorShown = useCallback(() => {
    setState((previous) =>
      previous.errorMessage === null ? previous : { ...previous, errorMessage: null },
    )
  }, [])

  return {
    state,
    onKeyPress,
    onDelete,
    onDeleteAtCursor,
    onMoveCursor,
    onCursorLeft,
    onCursorRight,
    onSubmit,
    onNewGame,
    onErrorShown,
  }
}

/**
 * Live Today / This Week / This Month rollups for the Progress screen.
 *
 * Subscribes to the stats store, so a game finished on the board screen is
 * reflected here without a reload. `nowMillis` is resolved once per render, which
 * is what pins "today" for the rollups.
 */
export function useStats(options?: { readonly store?: StatsStore; readonly now?: () => number }): StatsSummaries {
  const store = options?.store ?? statsStore
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.getRecords(), [store])
  // Reference-stable between writes (see `createStatsStore`), so this is a valid
  // `useSyncExternalStore` snapshot and does not loop.
  const records = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const nowFn = options?.now ?? Date.now
  return useMemo(() => summarizeAll(records, nowFn()), [records, nowFn])
}
