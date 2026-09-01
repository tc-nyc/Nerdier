import { GuessDistributionChart } from './GuessDistributionChart'
import { GameTrendChart } from './GameTrendChart'
import type { TrendGame } from './GameTrendChart'
import { BackIcon } from './Icons'
import { strings } from './strings'
import './Chrome.css'
import './ProgressScreen.css'

/**
 * What one Progress section needs to render.
 *
 * Field names match the coder's `StatsSummary` rollup, so a summary can be
 * passed straight in — structural typing does the adapting, and this screen
 * still stands up on its own for sample data. `games` is likewise a structural
 * subset of `readonly GameRecord[]`: the chart needs only the outcome and the
 * guess count, and asking for less keeps the two sides loosely coupled.
 */
export interface PeriodStats {
  readonly played: number
  readonly won: number
  readonly winPercent: number
  readonly currentStreak: number
  /**
   * Mean guesses over SOLVED games only — losses are excluded, because six
   * guesses spent without solving describes stamina, not skill. `0` is the
   * "no wins in this period" sentinel and is rendered as an em dash, never as
   * "0.0", which would claim an impossible average.
   */
  readonly averageGuesses: number
  /** Six counts: wins in 1, 2, 3, 4, 5, 6 guesses. */
  readonly guessDistribution: readonly number[]
  /** The period's games, oldest first. Drives the This Month line chart. */
  readonly games: readonly TrendGame[]
}

export const emptyPeriodStats: PeriodStats = {
  played: 0,
  won: 0,
  winPercent: 0,
  currentStreak: 0,
  averageGuesses: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
  games: [],
}

/** One decimal place, or an em dash when the period holds no solved game. */
export function formatAverageGuesses(average: number): string {
  if (!Number.isFinite(average) || average <= 0) return '—'
  return average.toFixed(1)
}

export interface ProgressScreenProps {
  readonly today: PeriodStats
  readonly thisWeek: PeriodStats
  readonly thisMonth: PeriodStats
  readonly onBack: () => void
}

export function ProgressScreen({
  today,
  thisWeek,
  thisMonth,
  onBack,
}: ProgressScreenProps) {
  return (
    <div className="nd-subscreen">
      <header className="nd-appbar">
        <button
          type="button"
          className="nd-iconbutton"
          aria-label={strings.actionBack}
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <h1 className="nd-appbar__title">{strings.progressTitle}</h1>
      </header>

      <div className="nd-subscreen__content">
        <div className="nd-subscreen__inner nd-progress">
          <PeriodSection title={strings.progressToday} stats={today} />
          <PeriodSection title={strings.progressThisWeek} stats={thisWeek} />
          {/* This Month alone gets the per-game trend; the two shorter periods
              hold too few games for a line to say anything a histogram cannot. */}
          <PeriodSection title={strings.progressThisMonth} stats={thisMonth} trend />

          {/* Once, at the end, rather than three times over: the definition is
              also on each Avg guesses cell's accessible name, so a screen reader
              hears it where the number is. */}
          <p className="nd-progress__note">{strings.statAvgGuessesNote}</p>
        </div>
      </div>
    </div>
  )
}

function PeriodSection({
  title,
  stats,
  trend = false,
}: {
  title: string
  stats: PeriodStats
  trend?: boolean
}) {
  const average = formatAverageGuesses(stats.averageGuesses)

  return (
    <section className="nd-progress__card" aria-label={title}>
      <h2>{title}</h2>

      <div className="nd-progress__stats">
        <StatCell label={strings.statPlayed} value={String(stats.played)} />
        <StatCell
          label={strings.statAvgGuesses}
          value={average}
          // An em dash is not a number and must not be spoken as one.
          spokenValue={average === '—' ? strings.statAvgGuessesNone : average}
          hint={strings.statAvgGuessesNote}
        />
        <StatCell label={strings.statWinRate} value={`${stats.winPercent}%`} />
        <StatCell label={strings.statStreak} value={String(stats.currentStreak)} />
      </div>

      <div className="nd-progress__divider" />

      <h3 className="nd-progress__subhead">
        {trend ? strings.progressTrend : strings.progressDistribution}
      </h3>

      {trend ? (
        <GameTrendChart games={stats.games} emptyMessage={strings.progressEmpty} />
      ) : stats.played === 0 ? (
        <p className="nd-progress__empty">{strings.progressEmpty}</p>
      ) : (
        <GuessDistributionChart distribution={stats.guessDistribution} />
      )}
    </section>
  )
}

/**
 * One headline number. The value and its label are one spoken phrase,
 * otherwise a screen reader reads a wall of bare digits.
 */
function StatCell({
  label,
  value,
  spokenValue,
  hint,
}: {
  label: string
  value: string
  /** Overrides `value` for assistive tech, e.g. when the value is an em dash. */
  spokenValue?: string
  /** Appended to the spoken phrase, for a definition that is not obvious. */
  hint?: string
}) {
  const spoken = spokenValue ?? value
  return (
    <div
      className="nd-progress__stat"
      role="group"
      aria-label={`${label}: ${spoken}${hint === undefined ? '' : `. ${hint}`}`}
    >
      <p className="nd-progress__value" aria-hidden="true">
        {value}
      </p>
      <p className="nd-progress__label" aria-hidden="true">
        {label}
      </p>
    </div>
  )
}
