import { MAX_GUESSES } from '../game/types'
import './GameTrendChart.css'

/**
 * One plotted game. A structural subset of the coder's `GameRecord`, so the
 * `games` array on a `StatsSummary` can be handed straight over.
 */
export interface TrendGame {
  readonly won: boolean
  /** Rows consumed, 1..6. A loss is six guesses *and* unsolved. */
  readonly guessesUsed: number
}

export interface GameTrendChartProps {
  /** The period's games, oldest first. */
  readonly games: readonly TrendGame[]
  /** Shown when the array is empty. */
  readonly emptyMessage?: string
}

/* --- Geometry --------------------------------------------------------------
 * A fixed user-space viewBox scaled uniformly to the container. One user unit
 * is one CSS pixel at exactly 320px wide — the narrowest phone we support — so
 * every size below can be read as "px at 320" and only ever grows from there.
 * ------------------------------------------------------------------------- */
const VB_W = 320
const VB_H = 148
const PLOT_LEFT = 24
const PLOT_RIGHT = 312
const PLOT_TOP = 12
const PLOT_BOTTOM = 116

/** y for a guess count, with 1 pinned to the TOP: higher on the chart is better. */
function yFor(guesses: number): number {
  const clamped = Math.min(Math.max(guesses, 1), MAX_GUESSES)
  return PLOT_TOP + ((clamped - 1) * (PLOT_BOTTOM - PLOT_TOP)) / (MAX_GUESSES - 1)
}

/** x for the i-th of n games. A single game is centred rather than pinned left. */
function xFor(index: number, count: number): number {
  if (count <= 1) return (PLOT_LEFT + PLOT_RIGHT) / 2
  return PLOT_LEFT + (index * (PLOT_RIGHT - PLOT_LEFT)) / (count - 1)
}

/**
 * Marker radius, thinned as the month fills up.
 *
 * At 320px the plot is 288 units wide, so 60 games sit 4.9 units apart. Keeping
 * a 4-unit radius there would overlap every neighbour into a solid caterpillar,
 * so the points shrink and the line — which never thins below 1.4 — becomes the
 * primary reading. The marker never drops under 1.5 (a 3-unit dot), which stays
 * visible, and the loss ring is always drawn a little larger than the win dot.
 */
function markerRadius(count: number): number {
  if (count <= 12) return 4
  if (count <= 25) return 3
  if (count <= 45) return 2.2
  return 1.5
}

function lineWidth(count: number): number {
  return count <= 30 ? 2 : 1.4
}

/**
 * Past this many games the points sit closer together than they are wide, and a
 * dot per win becomes a solid caterpillar that hides the very line it is meant
 * to annotate. Beyond it the win markers give way and the line carries the
 * shape on its own — the losses keep their rings, because a loss is the one
 * event that the line alone cannot distinguish from a six-guess win. Every game
 * is still plotted and still listed in the text alternative.
 */
const MARKER_LIMIT = 80

function clampGuesses(guesses: number): number {
  const rounded = Math.round(guesses)
  return Math.min(Math.max(rounded, 1), MAX_GUESSES)
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** "solved in 4 guesses" / "not solved, 6 guesses used" — never colour alone. */
export function describeGame(game: TrendGame, position: number, total: number): string {
  const g = clampGuesses(game.guessesUsed)
  const outcome = game.won
    ? `solved in ${g} ${plural(g, 'guess', 'guesses')}`
    : `not solved, all ${g} ${plural(g, 'guess', 'guesses')} used`
  return `Game ${position} of ${total}: ${outcome}`
}

/**
 * The chart's text alternative: the same trend a sighted player reads off the
 * line, in a sentence. Compares the first half of the month with the second,
 * because "is it getting better" is the only question the shape answers.
 */
export function summarizeTrend(games: readonly TrendGame[]): string {
  const total = games.length
  if (total === 0) return ''

  const wins = games.filter((g) => g.won)
  const solved = wins.length
  const unsolved = total - solved
  const counts = games.map((g) => clampGuesses(g.guessesUsed))
  const first = counts[0] ?? 0
  const last = counts[total - 1] ?? 0

  const only = games[0]
  if (total === 1 && only !== undefined) {
    const g = clampGuesses(only.guessesUsed)
    return only.won
      ? `One game this month, solved in ${g} ${plural(g, 'guess', 'guesses')}.`
      : `One game this month, not solved.`
  }

  const head = `${total} games this month, oldest first: ${solved} solved, ${unsolved} not solved.`

  const mean = (xs: readonly number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
  const half = Math.floor(total / 2)
  const earlier = mean(counts.slice(0, half))
  const later = mean(counts.slice(total - half))
  const delta = earlier - later
  const direction =
    Math.abs(delta) < 0.25
      ? 'roughly level'
      : delta > 0
        ? 'trending better — fewer guesses lately'
        : 'trending worse — more guesses lately'

  return `${head} First game ${first} ${plural(first, 'guess', 'guesses')}, latest game ${last} ${plural(
    last,
    'guess',
    'guesses',
  )}; ${direction}.`
}

/**
 * This Month's per-game line chart: one point per game in the order played,
 * y = guesses used with 1 at the top, so a HIGHER line is a better month.
 *
 * Plain SVG — no charting library, no measurement in JavaScript, no layout
 * effects. Losses are plotted too (a loss is six guesses *and* unsolved, which
 * a bare "6" would misreport as a merely-poor win), and are marked by a hollow
 * ring in a different colour rather than by colour alone.
 */
export function GameTrendChart({ games, emptyMessage }: GameTrendChartProps) {
  const count = games.length

  if (count === 0) {
    return (
      <p className="nd-trend__empty">
        {emptyMessage ?? 'No games played in this period yet.'}
      </p>
    )
  }

  const points = games.map((game, i) => ({
    game,
    x: xFor(i, count),
    y: yFor(clampGuesses(game.guessesUsed)),
  }))
  const r = markerRadius(count)
  const showWinPoints = count <= MARKER_LIMIT
  const rows = Array.from({ length: MAX_GUESSES }, (_unused, i) => i + 1)
  const polyline = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const summary = summarizeTrend(games)

  return (
    <div className="nd-trend">
      <p className="nd-trend__axis-note">
        Guesses used per game, in the order played. 1 is at the top, so a higher
        line is a better run.
      </p>

      {/* The drawing is decoration: everything it says is in the caption below
          and in the per-game list, both of which are real text. */}
      <svg
        className="nd-trend__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        {rows.map((g) => (
          <g key={g}>
            <line
              className="nd-trend__grid"
              x1={PLOT_LEFT}
              y1={yFor(g)}
              x2={PLOT_RIGHT}
              y2={yFor(g)}
            />
            <text className="nd-trend__ylabel" x={PLOT_LEFT - 7} y={yFor(g) + 3}>
              {g}
            </text>
          </g>
        ))}

        {/* One game is a point, not a line: a polyline of one is nothing at all
            and a stray zero-length stroke would read as a smudge. */}
        {count > 1 ? (
          <polyline
            className="nd-trend__line"
            points={polyline}
            strokeWidth={lineWidth(count)}
          />
        ) : null}

        {points.map((p, i) =>
          p.game.won ? (
            showWinPoints ? (
              <circle
                key={i}
                className="nd-trend__point nd-trend__point--win"
                cx={p.x}
                cy={p.y}
                r={r}
              >
                <title>{describeGame(p.game, i + 1, count)}</title>
              </circle>
            ) : null
          ) : (
            <circle
              key={i}
              className="nd-trend__point nd-trend__point--loss"
              cx={p.x}
              cy={p.y}
              r={r + 0.8}
              strokeWidth={Math.max(1.2, r * 0.5)}
            >
              <title>{describeGame(p.game, i + 1, count)}</title>
            </circle>
          ),
        )}

        <text className="nd-trend__xlabel" x={PLOT_LEFT} y={VB_H - 12}>
          oldest
        </text>
        <text className="nd-trend__xlabel nd-trend__xlabel--end" x={PLOT_RIGHT} y={VB_H - 12}>
          newest
        </text>
      </svg>

      <ul className="nd-trend__legend" aria-hidden="true">
        <li>
          <span className="nd-trend__swatch nd-trend__swatch--win" /> Solved
        </li>
        <li>
          <span className="nd-trend__swatch nd-trend__swatch--loss" /> Not solved
        </li>
      </ul>

      <p className="nd-trend__caption">{summary}</p>

      {/* A reachable label per point. Visually hidden because the graphic says
          the same thing to anyone who can see it, but it is real, navigable
          text — not a tooltip, which a screen reader would never reach. */}
      <ol className="nd-visually-hidden" aria-label="Every game this month, in order">
        {games.map((game, i) => (
          <li key={i}>{describeGame(game, i + 1, count)}</li>
        ))}
      </ol>
    </div>
  )
}
