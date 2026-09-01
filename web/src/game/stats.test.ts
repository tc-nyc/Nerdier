/**
 * Period bucketing, rollups, and the storage layer.
 *
 * Ported case-for-case from `StatsCalculatorTest.kt`. The Kotlin pinned the zone
 * to UTC; the port pins the *dates* instead — every day here is built with the
 * local-time `Date(y, m, d)` constructor, so the assertions hold on any machine
 * without the calculator needing a zone parameter. The fixed 2026 dates are the
 * originals: week and month boundaries are exactly where off-by-one errors hide.
 */

import { describe, expect, it } from 'vitest'
import {
  isInPeriod,
  localDate,
  summarize,
  summarizeAll,
  weekStart,
  type GameRecord,
  type StatsPeriod,
} from './stats'
import {
  MAX_RECORDS,
  createStatsStore,
  decodeRecords,
  encodeRecords,
  type StorageLike,
} from './storage'

/** "2026-08-17" -> that calendar day at local midnight. */
function day(iso: string): Date {
  const parts = iso.split('-').map(Number)
  const [y, m, d] = [parts[0] ?? 0, parts[1] ?? 1, parts[2] ?? 1]
  return new Date(y, m - 1, d)
}

/** Epoch millis for a date at local midday, safely clear of any day boundary. */
function at(iso: string): number {
  const d = day(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).getTime()
}

const inPeriod = (d: string, today: string, period: StatsPeriod): boolean =>
  isInPeriod(day(d), day(today), period)

// ---- week boundaries ------------------------------------------------------
// 2026-08-17 is a Monday; 2026-08-23 is the Sunday that closes that week.

describe('week boundaries', () => {
  it('starts the week on monday', () => {
    expect(weekStart(day('2026-08-21')).getTime()).toBe(day('2026-08-17').getTime())
    expect(
      weekStart(day('2026-08-17')).getTime(),
      'a Monday is its own week start',
    ).toBe(day('2026-08-17').getTime())
  })

  it('includes its monday and its sunday', () => {
    expect(inPeriod('2026-08-17', '2026-08-21', 'this-week')).toBe(true)
    expect(
      inPeriod('2026-08-23', '2026-08-21', 'this-week'),
      'Sunday closes the week, it does not start the next one',
    ).toBe(true)
  })

  it('excludes the day either side', () => {
    expect(inPeriod('2026-08-16', '2026-08-21', 'this-week')).toBe(false) // prior Sunday
    expect(inPeriod('2026-08-24', '2026-08-21', 'this-week')).toBe(false) // next Monday
  })

  it('holds a week together across a month boundary', () => {
    // Mon 2026-08-31 .. Sun 2026-09-06
    expect(inPeriod('2026-08-31', '2026-09-02', 'this-week')).toBe(true)
    expect(inPeriod('2026-09-06', '2026-09-02', 'this-week')).toBe(true)
  })
})

// ---- month boundaries -----------------------------------------------------

describe('month boundaries', () => {
  it('uses the calendar month and does not roll december into january', () => {
    expect(inPeriod('2026-08-01', '2026-08-21', 'this-month')).toBe(true)
    expect(inPeriod('2026-08-31', '2026-08-21', 'this-month')).toBe(true)
    expect(inPeriod('2026-07-31', '2026-08-21', 'this-month')).toBe(false)
    expect(inPeriod('2026-09-01', '2026-08-21', 'this-month')).toBe(false)
    // Same month number, different year.
    expect(inPeriod('2025-12-15', '2026-12-15', 'this-month')).toBe(false)
  })

  it('treats today as a single calendar day', () => {
    expect(inPeriod('2026-08-21', '2026-08-21', 'today')).toBe(true)
    expect(inPeriod('2026-08-20', '2026-08-21', 'today')).toBe(false)
  })

  it('maps a timestamp to its local calendar day', () => {
    expect(localDate(at('2026-08-21')).getTime()).toBe(day('2026-08-21').getTime())
  })
})

// ---- rollups --------------------------------------------------------------

const records: readonly GameRecord[] = [
  { timestampMillis: at('2026-08-10'), won: true, guessesUsed: 3 }, // this month, PRIOR week
  { timestampMillis: at('2026-08-17'), won: false, guessesUsed: 6 }, // Monday of this week
  { timestampMillis: at('2026-08-21'), won: true, guessesUsed: 4 }, // today
  { timestampMillis: at('2026-08-21'), won: true, guessesUsed: 2 }, // today
  { timestampMillis: at('2026-07-30'), won: true, guessesUsed: 1 }, // last month
]

const now = at('2026-08-21')

describe('rollups', () => {
  it('counts only today in the today rollup', () => {
    const s = summarize(records, 'today', now)
    expect(s.played).toBe(2)
    expect(s.won).toBe(2)
    expect(s.winPercent).toBe(100)
  })

  it('spans monday through today in the week rollup', () => {
    const s = summarize(records, 'this-week', now)
    expect(s.played, 'Aug 17 loss plus both Aug 21 wins').toBe(3)
    expect(s.won).toBe(2)
    expect(s.winPercent).toBe(67) // 66.67 rounds half-up
  })

  it('excludes the previous month from the month rollup', () => {
    const s = summarize(records, 'this-month', now)
    expect(s.played, 'Jul 30 must not be counted').toBe(4)
    expect(s.won).toBe(3)
    expect(s.lost).toBe(1)
  })

  it('counts the streak back from the most recent game and breaks it on a loss', () => {
    const s = summarize(records, 'this-month', now)
    expect(s.currentStreak, 'two wins today, then the Aug 17 loss stops it').toBe(2)
  })

  it('zeroes the streak when the most recent game is a loss', () => {
    const withLateLoss: GameRecord[] = [
      ...records,
      { timestampMillis: at('2026-08-21') + 1, won: false, guessesUsed: 6 },
    ]
    const s = summarize(withLateLoss, 'today', now)
    expect(s.currentStreak).toBe(0)
  })

  it('buckets wins by guesses used and ignores losses', () => {
    const s = summarize(records, 'this-month', now)
    // index 0 == solved in 1 guess
    expect(s.guessDistribution).toEqual([0, 1, 1, 1, 0, 0])
    expect(s.maxDistributionCount).toBe(1)
  })

  it('returns all zeroes for an empty history without dividing by zero', () => {
    const s = summarize([], 'today', now)
    expect(s.played).toBe(0)
    expect(s.winPercent).toBe(0)
    expect(s.currentStreak).toBe(0)
    expect(s.maxDistributionCount).toBe(1)
  })

  it('averages guesses over wins only, never over losses', () => {
    // A win in 3 and a win in 5 average 4. The 6-guess loss must not drag it to
    // 14/3 = 4.67: it consumed six rows without solving, so it is not a score.
    const mixed: readonly GameRecord[] = [
      { timestampMillis: at('2026-08-21'), won: true, guessesUsed: 3 },
      { timestampMillis: at('2026-08-21') + 1, won: false, guessesUsed: 6 },
      { timestampMillis: at('2026-08-21') + 2, won: true, guessesUsed: 5 },
    ]
    const s = summarize(mixed, 'today', now)
    expect(s.averageGuesses).toBe(4)
  })

  it('reports 0 average guesses when the period holds no wins', () => {
    // 0 is the "no wins" sentinel the UI renders as an em dash. What it must not
    // be is NaN, which 0/0 would give.
    const allLosses: readonly GameRecord[] = [
      { timestampMillis: at('2026-08-21'), won: false, guessesUsed: 6 },
      { timestampMillis: at('2026-08-21') + 1, won: false, guessesUsed: 6 },
    ]
    const s = summarize(allLosses, 'today', now)
    expect(s.played).toBe(2)
    expect(s.won).toBe(0)
    expect(s.averageGuesses).toBe(0)
    expect(Number.isNaN(s.averageGuesses)).toBe(false)
  })

  it('averages a single win to that win\'s guess count', () => {
    const one: readonly GameRecord[] = [
      { timestampMillis: at('2026-08-21'), won: true, guessesUsed: 2 },
    ]
    expect(summarize(one, 'today', now).averageGuesses).toBe(2)
  })

  it('averages 0 for an empty period', () => {
    expect(summarize([], 'today', now).averageGuesses).toBe(0)
  })

  it('averages the shared fixture over its three wins', () => {
    // This month: wins in 3, 4 and 2 guesses, plus the Aug 17 loss. (3+4+2)/3 = 3.
    expect(summarize(records, 'this-month', now).averageGuesses).toBe(3)
  })

  it('returns the in-period games in chronological order', () => {
    // The fixture is deliberately out of order (Jul 30 is last in the array), so
    // this pins the sort as well as the filter.
    const s = summarize(records, 'this-month', now)
    expect(s.games.map((r) => r.timestampMillis)).toEqual([
      at('2026-08-10'),
      at('2026-08-17'),
      at('2026-08-21'),
      at('2026-08-21'),
    ])
    expect(s.games).toHaveLength(s.played)
  })

  it('excludes out-of-period games from the series', () => {
    const week = summarize(records, 'this-week', now)
    // Aug 10 is this month but the PRIOR week; Jul 30 is last month.
    expect(week.games.map((r) => r.timestampMillis)).toEqual([
      at('2026-08-17'),
      at('2026-08-21'),
      at('2026-08-21'),
    ])
    const today = summarize(records, 'today', now)
    expect(today.games.map((r) => r.guessesUsed)).toEqual([4, 2])
  })

  it('keeps losses in the series, since the chart plots them too', () => {
    const s = summarize(records, 'this-month', now)
    expect(s.games.map((r) => r.won)).toEqual([true, false, true, true])
    expect(s.games.map((r) => r.guessesUsed)).toEqual([3, 6, 4, 2])
  })

  it('returns an empty series for an empty period', () => {
    expect(summarize([], 'today', now).games).toEqual([])
    // Also for a non-empty history whose games all fall outside the window.
    expect(summarize(records, 'today', at('2026-08-20')).games).toEqual([])
  })

  it('produces all three rollups at once', () => {
    const all = summarizeAll(records, now)
    expect(all.today.played).toBe(2)
    expect(all.thisWeek.played).toBe(3)
    expect(all.thisMonth.played).toBe(4)
    expect(all.today.period).toBe('today')
    expect(all.thisWeek.period).toBe('this-week')
    expect(all.thisMonth.period).toBe('this-month')
  })
})

// ---- storage --------------------------------------------------------------

/** An in-memory `StorageLike`, standing in for the browser's localStorage. */
function fakeStorage(seed?: string): StorageLike & { readonly data: Map<string, string> } {
  const data = new Map<string, string>()
  if (seed !== undefined) data.set('nerdier.stats.v1', seed)
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v)
    },
    removeItem: (k) => {
      data.delete(k)
    },
  }
}

describe('storage', () => {
  it('round-trips records through the backend', () => {
    const backend = fakeStorage()
    const store = createStatsStore(backend)
    store.record({ timestampMillis: at('2026-08-21'), won: true, guessesUsed: 3 })

    // A fresh store over the same backend sees the write — this is the
    // process-death case.
    const reopened = createStatsStore(backend)
    expect(reopened.getRecords()).toEqual([
      { timestampMillis: at('2026-08-21'), won: true, guessesUsed: 3 },
    ])
  })

  it('keeps records in chronological order', () => {
    const store = createStatsStore(fakeStorage())
    store.record({ timestampMillis: at('2026-08-21'), won: true, guessesUsed: 3 })
    store.record({ timestampMillis: at('2026-08-10'), won: false, guessesUsed: 6 })
    expect(store.getRecords().map((r) => r.timestampMillis)).toEqual([
      at('2026-08-10'),
      at('2026-08-21'),
    ])
  })

  it('returns a reference-stable snapshot between writes', () => {
    const store = createStatsStore(fakeStorage())
    const first = store.getRecords()
    expect(store.getRecords()).toBe(first)
    store.record({ timestampMillis: now, won: true, guessesUsed: 1 })
    expect(store.getRecords()).not.toBe(first)
  })

  it('notifies subscribers and stops after unsubscribe', () => {
    const store = createStatsStore(fakeStorage())
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls++
    })
    store.record({ timestampMillis: now, won: true, guessesUsed: 1 })
    expect(calls).toBe(1)
    unsubscribe()
    store.record({ timestampMillis: now, won: true, guessesUsed: 2 })
    expect(calls).toBe(1)
  })

  it('caps history at MAX_RECORDS, keeping the newest', () => {
    const store = createStatsStore(fakeStorage())
    for (let i = 0; i < MAX_RECORDS + 5; i++) {
      store.record({ timestampMillis: now + i, won: true, guessesUsed: 1 })
    }
    const kept = store.getRecords()
    expect(kept).toHaveLength(MAX_RECORDS)
    expect(kept[0]?.timestampMillis).toBe(now + 5)
  })

  it('tolerates corrupt and malformed stored data', () => {
    expect(decodeRecords(null)).toEqual([])
    expect(decodeRecords('')).toEqual([])
    expect(decodeRecords('not json at all')).toEqual([])
    expect(decodeRecords('{"nope":1}')).toEqual([])
    expect(
      decodeRecords(
        JSON.stringify([
          { timestampMillis: 1, won: true, guessesUsed: 2 },
          { timestampMillis: 'yesterday', won: true, guessesUsed: 2 }, // bad type
          { won: true, guessesUsed: 2 }, // missing field
          null,
          'garbage',
          { timestampMillis: 3, won: false, guessesUsed: 6 },
        ]),
      ),
    ).toEqual([
      { timestampMillis: 1, won: true, guessesUsed: 2 },
      { timestampMillis: 3, won: false, guessesUsed: 6 },
    ])
  })

  it('encodes to the same shape it decodes', () => {
    const seed: GameRecord[] = [{ timestampMillis: 7, won: true, guessesUsed: 4 }]
    expect(decodeRecords(encodeRecords(seed))).toEqual(seed)
  })

  it('degrades to memory when the backend throws (Safari private mode)', () => {
    const thrower: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    const store = createStatsStore(thrower)
    expect(store.getRecords()).toEqual([])
    expect(() => store.record({ timestampMillis: now, won: true, guessesUsed: 3 })).not.toThrow()
    // The write is kept in memory so the current session still reads back.
    expect(store.getRecords()).toHaveLength(1)
    expect(() => store.clear()).not.toThrow()
    expect(store.getRecords()).toEqual([])
  })

  it('starts empty when the stored value is corrupt', () => {
    const store = createStatsStore(fakeStorage(']]not json[['))
    expect(store.getRecords()).toEqual([])
  })

  it('feeds the rollups straight from the store', () => {
    const store = createStatsStore(fakeStorage())
    store.record({ timestampMillis: at('2026-08-21'), won: true, guessesUsed: 3 })
    store.record({ timestampMillis: at('2026-08-17'), won: false, guessesUsed: 6 })
    const summaries = summarizeAll(store.getRecords(), now)
    expect(summaries.today.played).toBe(1)
    expect(summaries.thisWeek.played).toBe(2)
    expect(summaries.thisWeek.won).toBe(1)
  })
})
