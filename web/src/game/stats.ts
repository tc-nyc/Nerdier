/**
 * Stats models plus period bucketing and aggregation.
 *
 * Pure functions — no I/O, no React, and **no clock of their own**: every entry
 * point takes `nowMillis`, exactly as the Android `StatsCalculator` did, so every
 * boundary case is unit testable.
 *
 * Dates use the platform `Date` in the browser's local zone (no date library —
 * the whole job is "which calendar day is this timestamp on", and `Date` answers
 * that). A calendar day is represented as a `Date` pinned to local midnight, which
 * makes day comparison a plain `getTime()` comparison and keeps DST-safe calendar
 * arithmetic (`new Date(y, m, d + 7)`) available.
 *
 * The week starts **Monday** (ISO-8601) and is the half-open range
 * `[Monday, Monday + 7 days)`. The month compares year AND month, so a
 * December/January rollover does not silently merge.
 */

/**
 * One finished game.
 *
 * @property timestampMillis when the game ended, epoch millis.
 * @property won true if the player solved it.
 * @property guessesUsed rows consumed, 1..6. Invalid submissions never counted, so
 *   a loss is always 6.
 */
export interface GameRecord {
  readonly timestampMillis: number
  readonly won: boolean
  readonly guessesUsed: number
}

/** Which window a rollup covers. */
export type StatsPeriod = 'today' | 'this-week' | 'this-month'

export const STATS_PERIODS: readonly StatsPeriod[] = ['today', 'this-week', 'this-month']

/**
 * A rollup over one `StatsPeriod`.
 *
 * @property guessDistribution always 6 entries; index 0 is "solved in 1 guess",
 *   index 5 is "solved in 6". Losses are not represented here.
 * @property maxDistributionCount largest bar, for scaling the chart. At least 1,
 *   so the designer can divide by it.
 * @property averageGuesses mean guesses over **solved games only**; losses are
 *   excluded, because a loss burned six guesses without solving anything and
 *   folding it in would describe stamina rather than skill. **0 when the period
 *   holds no wins** — that is a sentinel, not an average, and the UI renders it
 *   as an em dash. Deliberately *not* rounded here: the raw mean is the model's
 *   answer and the UI formats it to one decimal place.
 * @property games the in-period records in chronological order (oldest first),
 *   for the This Month per-game line chart, which needs the series rather than
 *   the rollup. Wins *and* losses, since a loss is a plotted point too.
 *
 *   Memory: these are the same `GameRecord` objects the store already holds, not
 *   copies, so a summary adds one array of at most `MAX_RECORDS` (1000)
 *   references. The cap therefore lives in exactly one place — `storage.ts`,
 *   which trims history on write — and is not duplicated here; `summarize` stays
 *   a pure function of whatever it is handed, and a second literal 1000 in this
 *   file could only ever drift out of step with the first.
 */
export interface StatsSummary {
  readonly period: StatsPeriod
  readonly played: number
  readonly won: number
  readonly lost: number
  readonly winPercent: number
  readonly currentStreak: number
  readonly guessDistribution: readonly number[]
  readonly maxDistributionCount: number
  readonly averageGuesses: number
  readonly games: readonly GameRecord[]
}

/** All three rollups, so the Progress screen renders from a single object. */
export interface StatsSummaries {
  readonly today: StatsSummary
  readonly thisWeek: StatsSummary
  readonly thisMonth: StatsSummary
}

export const emptySummary = (period: StatsPeriod): StatsSummary => ({
  period,
  played: 0,
  won: 0,
  lost: 0,
  winPercent: 0,
  currentStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
  maxDistributionCount: 1,
  averageGuesses: 0,
  games: [],
})

/** Local calendar day a timestamp belongs to, as a `Date` at local midnight. */
export function localDate(timestampMillis: number): Date {
  const d = new Date(timestampMillis)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Monday of the week containing `day`. Returns `day` itself when it is a Monday. */
export function weekStart(day: Date): Date {
  // getDay(): 0 = Sunday .. 6 = Saturday. Distance back to Monday:
  // Mon 0, Tue 1, ... Sun 6.
  const backToMonday = (day.getDay() + 6) % 7
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - backToMonday)
}

const sameDay = (a: Date, b: Date): boolean => a.getTime() === b.getTime()

/**
 * True when `day` falls inside `period` as measured from `today`. Both arguments
 * are local-midnight days (see `localDate`).
 */
export function isInPeriod(day: Date, today: Date, period: StatsPeriod): boolean {
  switch (period) {
    case 'today':
      return sameDay(day, today)
    case 'this-week': {
      const start = weekStart(today)
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
      return day.getTime() >= start.getTime() && day.getTime() < end.getTime()
    }
    case 'this-month':
      return day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth()
  }
}

/**
 * Rolls `records` up over `period`.
 *
 * `currentStreak` is the run of wins at the *end* of the period's games in
 * chronological order — i.e. how many games in a row the player has won as of
 * their most recent game inside this window. A loss resets it to 0. It is
 * game-based, not calendar-day-based: skipping a day does not break it, and two
 * games on one day both count.
 */
export function summarize(
  records: readonly GameRecord[],
  period: StatsPeriod,
  nowMillis: number,
): StatsSummary {
  const today = localDate(nowMillis)
  const selected = records
    .filter((r) => isInPeriod(localDate(r.timestampMillis), today, period))
    .slice()
    .sort((a, b) => a.timestampMillis - b.timestampMillis)

  if (selected.length === 0) return emptySummary(period)

  const played = selected.length
  const won = selected.filter((r) => r.won).length

  const distribution = [0, 0, 0, 0, 0, 0]
  // Summed over wins only, in step with `won`, so the division below cannot be
  // skewed by a loss's six guesses.
  let wonGuesses = 0
  for (const r of selected) {
    if (r.won) wonGuesses += r.guessesUsed
    if (r.won && r.guessesUsed >= 1 && r.guessesUsed <= 6) {
      const i = r.guessesUsed - 1
      distribution[i] = (distribution[i] ?? 0) + 1
    }
  }

  let currentStreak = 0
  for (let i = selected.length - 1; i >= 0; i--) {
    if (selected[i]?.won !== true) break
    currentStreak++
  }

  return {
    period,
    played,
    won,
    lost: played - won,
    // Rounded half-up, matching what players expect from a percentage.
    winPercent: Math.round((won * 100) / played),
    currentStreak,
    guessDistribution: distribution,
    maxDistributionCount: Math.max(1, ...distribution),
    // Guarded: a period can be all losses, and 0/0 is NaN, which would reach the
    // screen as "NaN". 0 is the agreed "no wins" sentinel.
    averageGuesses: won === 0 ? 0 : wonGuesses / won,
    // `selected` is already filtered to the period and sorted oldest-first, and
    // is a fresh array this function owns, so it can be handed over as-is.
    games: selected,
  }
}

export function summarizeAll(records: readonly GameRecord[], nowMillis: number): StatsSummaries {
  return {
    today: summarize(records, 'today', nowMillis),
    thisWeek: summarize(records, 'this-week', nowMillis),
    thisMonth: summarize(records, 'this-month', nowMillis),
  }
}

export const emptySummaries = (): StatsSummaries => ({
  today: emptySummary('today'),
  thisWeek: emptySummary('this-week'),
  thisMonth: emptySummary('this-month'),
})
