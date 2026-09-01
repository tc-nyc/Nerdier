import { MAX_GUESSES } from '../game/types'
import './GuessDistributionChart.css'

export interface GuessDistributionChartProps {
  /** Six counts: wins in 1, 2, 3, 4, 5 and 6 guesses. Short arrays read zero. */
  readonly distribution: readonly number[]
}

/** Zero keeps a 4% stub; a non-zero bar never dips below 10% so it stays a bar. */
function barPercent(count: number, peak: number): number {
  if (count <= 0) return 4
  if (peak <= 0) return 4
  return Math.max(10, (count / peak) * 100)
}

export function GuessDistributionChart({ distribution }: GuessDistributionChartProps) {
  const counts: number[] = Array.from(
    { length: MAX_GUESSES },
    (_, i) => distribution[i] ?? 0,
  )
  // No spread into Math.max: an empty array would give -Infinity.
  const peak = counts.reduce((a, b) => (b > a ? b : a), 0)
  const total = counts.reduce((a, b) => a + b, 0)

  return (
    <div className="nd-chart">
      <div className="nd-chart__cols">
        {counts.map((count, index) => (
          <div
            className="nd-chart__col"
            key={index}
            role="img"
            aria-label={`${count} ${count === 1 ? 'win' : 'wins'} in ${index + 1} ${
              index === 0 ? 'guess' : 'guesses'
            }`}
          >
            <p className="nd-chart__count" aria-hidden="true">
              {count}
            </p>
            <div className="nd-chart__track" aria-hidden="true">
              <div
                className={`nd-chart__bar${count === 0 ? ' nd-chart__bar--zero' : ''}`}
                style={{ height: `${barPercent(count, peak)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="nd-chart__axis" aria-hidden="true">
        {counts.map((_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>

      <p className="nd-chart__caption">
        {total === 0
          ? 'No wins recorded yet.'
          : `Guesses used, across ${total} ${total === 1 ? 'win' : 'wins'}.`}
      </p>
    </div>
  )
}
