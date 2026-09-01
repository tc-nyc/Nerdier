/**
 * Persistent history of finished games.
 *
 * ---------------------------------------------------------------------------
 * Persistence choice: `localStorage` (NOT IndexedDB, NOT a backend).
 *
 * What we store is one append-only list of three-field records that is always
 * read in full and never queried relationally — no joins, no indexes, no partial
 * updates. IndexedDB would buy asynchrony and a transaction model we do not need
 * for a value measured in kilobytes; `localStorage` is synchronous, which is what
 * lets `getSnapshot()` below be a plain function for `useSyncExternalStore`.
 * There is no backend, by contract, so this is the whole of persistence.
 *
 * Everything here is defensive. `localStorage` throws outright in Safari private
 * mode and when a site is opened with storage disabled, it can be full, and the
 * value it hands back can be anything at all (another tab, an older build, a user
 * poking at devtools). Stats are not load-bearing for play, so every failure
 * degrades to an in-memory store rather than breaking the game.
 *
 * `MAX_RECORDS` keeps the single value small; at one game per day it is decades
 * of history, and the rollups only ever look back one month.
 * ---------------------------------------------------------------------------
 */

import type { GameRecord } from './stats'

export const STATS_STORAGE_KEY = 'nerdier.stats.v1'
export const MAX_RECORDS = 1000

/** The slice of the Web Storage API we use. Lets tests inject a fake or a thrower. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface StatsStore {
  /** Every recorded game, oldest first. Reference-stable until the next write. */
  getRecords(): readonly GameRecord[]
  /** Appends one finished game. Called once, when a game reaches won or lost. */
  record(entry: GameRecord): void
  /** Drops all history. */
  clear(): void
  /** `useSyncExternalStore` subscription; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

/** A `StorageLike` that keeps one string in memory. The fallback when nothing else works. */
function memoryStorage(): StorageLike {
  const cell = new Map<string, string>()
  return {
    getItem: (key) => cell.get(key) ?? null,
    setItem: (key, value) => {
      cell.set(key, value)
    },
    removeItem: (key) => {
      cell.delete(key)
    },
  }
}

/**
 * `globalThis.localStorage` if it exists and actually works, otherwise an
 * in-memory stand-in. Merely *touching* the property throws in some browsers, so
 * the probe is inside the try.
 */
export function defaultStorage(): StorageLike {
  try {
    const ls = globalThis.localStorage as StorageLike | undefined
    if (!ls) return memoryStorage()
    // A write probe: private-mode Safari exposes the object then throws on write.
    const probe = `${STATS_STORAGE_KEY}.probe`
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    return memoryStorage()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Tolerant by design: a malformed entry is dropped, not fatal. */
export function decodeRecords(raw: string | null): GameRecord[] {
  if (raw === null || raw === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: GameRecord[] = []
  for (const entry of parsed) {
    if (!isRecord(entry)) continue
    const { timestampMillis, won, guessesUsed } = entry
    if (typeof timestampMillis !== 'number' || !Number.isFinite(timestampMillis)) continue
    if (typeof guessesUsed !== 'number' || !Number.isFinite(guessesUsed)) continue
    if (typeof won !== 'boolean') continue
    out.push({ timestampMillis, won, guessesUsed })
  }
  out.sort((a, b) => a.timestampMillis - b.timestampMillis)
  return out
}

export function encodeRecords(records: readonly GameRecord[]): string {
  return JSON.stringify(
    records.map((r) => ({
      timestampMillis: r.timestampMillis,
      won: r.won,
      guessesUsed: r.guessesUsed,
    })),
  )
}

/**
 * Builds a store over `backend` (defaults to `localStorage`, or memory if that is
 * unusable).
 *
 * The record list is cached in memory and only replaced on write, so
 * `getRecords()` is safe to use as a `useSyncExternalStore` snapshot: it returns
 * the same array reference until something actually changes.
 */
export function createStatsStore(backend: StorageLike = defaultStorage()): StatsStore {
  let cache: readonly GameRecord[] = readInitial(backend)
  const listeners = new Set<() => void>()

  function readInitial(store: StorageLike): readonly GameRecord[] {
    try {
      return decodeRecords(store.getItem(STATS_STORAGE_KEY))
    } catch {
      // Reading can throw as well (disabled storage, security errors).
      return []
    }
  }

  function persist(records: readonly GameRecord[]): void {
    try {
      backend.setItem(STATS_STORAGE_KEY, encodeRecords(records))
    } catch {
      // Quota exceeded, private mode, storage disabled: keep the in-memory cache
      // so this session's stats still read back, and carry on. Never throw into
      // the game loop.
    }
  }

  function emit(): void {
    for (const listener of listeners) listener()
  }

  return {
    getRecords: () => cache,

    record(entry: GameRecord) {
      const next = [...cache, entry]
        .sort((a, b) => a.timestampMillis - b.timestampMillis)
        .slice(-MAX_RECORDS)
      cache = next
      persist(next)
      emit()
    },

    clear() {
      cache = []
      try {
        backend.removeItem(STATS_STORAGE_KEY)
      } catch {
        // Same policy as persist(): a storage failure must not break the game.
      }
      emit()
    },

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** The app's single store. Tests build their own with `createStatsStore(fake)`. */
export const statsStore: StatsStore = createStatsStore()
