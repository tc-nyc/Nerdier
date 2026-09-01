/**
 * @vitest-environment jsdom
 *
 * The This Month trend chart: the degenerate cases, the loss marking, and the
 * thinning that keeps a busy month readable at 320px.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { GameTrendChart, summarizeTrend } from './GameTrendChart'
import type { TrendGame } from './GameTrendChart'

afterEach(cleanup)

const win = (guessesUsed: number): TrendGame => ({ won: true, guessesUsed })
const loss = (): TrendGame => ({ won: false, guessesUsed: 6 })

/** The rendered <svg>. Queried from the container because it is aria-hidden. */
const svg = (container: HTMLElement): SVGSVGElement => {
  const el = container.querySelector('svg')
  if (el === null) throw new Error('no svg rendered')
  return el
}

describe('GameTrendChart degenerate cases', () => {
  it('shows the empty message and draws nothing for zero games', () => {
    const { container } = render(
      <GameTrendChart games={[]} emptyMessage="No games played in this period yet." />,
    )
    expect(screen.getByText('No games played in this period yet.')).toBeDefined()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('draws one point and no line for a single game', () => {
    const { container } = render(<GameTrendChart games={[win(3)]} />)
    const chart = svg(container)
    expect(chart.querySelectorAll('polyline')).toHaveLength(0)
    expect(chart.querySelectorAll('circle')).toHaveLength(1)
  })

  it('centres the single point rather than pinning it to the left edge', () => {
    const { container } = render(<GameTrendChart games={[win(3)]} />)
    const point = svg(container).querySelector('circle')
    expect(point?.getAttribute('cx')).toBe('168')
  })

  it('joins many games with a single polyline of one point per game', () => {
    const games = [win(3), loss(), win(2), win(5), win(1)]
    const { container } = render(<GameTrendChart games={games} />)
    const chart = svg(container)
    const lines = chart.querySelectorAll('polyline')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.getAttribute('points')?.trim().split(/\s+/)).toHaveLength(games.length)
    expect(chart.querySelectorAll('circle')).toHaveLength(games.length)
  })
})

describe('GameTrendChart axis direction', () => {
  it('puts 1 guess above 6 guesses, so a higher line is better', () => {
    const { container } = render(<GameTrendChart games={[win(1), win(6)]} />)
    const circles = Array.from(svg(container).querySelectorAll('circle'))
    const yOf = (c: Element | undefined): number => Number(c?.getAttribute('cy') ?? NaN)
    expect(yOf(circles[0])).toBeLessThan(yOf(circles[1]))
  })

  it('labels every row of the axis, 1 through 6', () => {
    const { container } = render(<GameTrendChart games={[win(3)]} />)
    const labels = Array.from(
      svg(container).querySelectorAll('.nd-trend__ylabel'),
    ).map((t) => t.textContent)
    expect(labels).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('says which way is better in visible text, not by position alone', () => {
    render(<GameTrendChart games={[win(3), win(4)]} />)
    expect(screen.getByText(/1 is at the top, so a higher line is a better run/)).toBeDefined()
  })
})

describe('GameTrendChart loss marking', () => {
  it('marks a loss with a different class from a win, not colour alone', () => {
    const { container } = render(<GameTrendChart games={[win(4), loss()]} />)
    const chart = svg(container)
    expect(chart.querySelectorAll('.nd-trend__point--win')).toHaveLength(1)
    expect(chart.querySelectorAll('.nd-trend__point--loss')).toHaveLength(1)
  })

  it('draws the loss ring larger than the win dot so it survives thinning', () => {
    const { container } = render(<GameTrendChart games={[win(6), loss()]} />)
    const circles = Array.from(svg(container).querySelectorAll('circle'))
    const rOf = (c: Element | undefined): number => Number(c?.getAttribute('r') ?? NaN)
    expect(rOf(circles[1])).toBeGreaterThan(rOf(circles[0]))
  })

  it('plots a loss even though it shares the bottom row with a six-guess win', () => {
    const { container } = render(<GameTrendChart games={[win(6), loss()]} />)
    const circles = Array.from(svg(container).querySelectorAll('circle'))
    expect(circles[0]?.getAttribute('cy')).toBe(circles[1]?.getAttribute('cy'))
    expect(circles[0]?.getAttribute('class')).not.toBe(circles[1]?.getAttribute('class'))
  })
})

describe('GameTrendChart density', () => {
  const manyOf = (n: number): TrendGame[] =>
    Array.from({ length: n }, (_unused, i) => win((i % 6) + 1))

  const radiusOf = (n: number): number => {
    const { container } = render(<GameTrendChart games={manyOf(n)} />)
    const r = Number(svg(container).querySelector('circle')?.getAttribute('r') ?? NaN)
    cleanup()
    return r
  }

  it('thins the markers as the month fills up', () => {
    expect(radiusOf(50)).toBeLessThan(radiusOf(30))
    expect(radiusOf(30)).toBeLessThan(radiusOf(5))
  })

  it('never lets a marker collapse to nothing', () => {
    expect(radiusOf(60)).toBeGreaterThanOrEqual(1.5)
    expect(radiusOf(80)).toBeGreaterThanOrEqual(1.5)
  })

  it('drops the win dots past 80 games but keeps the line and every loss ring', () => {
    const games: TrendGame[] = manyOf(200)
    games[10] = { won: false, guessesUsed: 6 }
    games[150] = { won: false, guessesUsed: 6 }
    const { container } = render(<GameTrendChart games={games} />)
    const chart = svg(container)
    expect(chart.querySelectorAll('.nd-trend__point--win')).toHaveLength(0)
    expect(chart.querySelectorAll('.nd-trend__point--loss')).toHaveLength(2)
    expect(chart.querySelectorAll('polyline')).toHaveLength(1)
    // The data is untouched: the line still carries all 200 games.
    expect(
      chart.querySelector('polyline')?.getAttribute('points')?.trim().split(/\s+/),
    ).toHaveLength(200)
  })

  it('still lists all 200 games as text when the dots are dropped', () => {
    render(<GameTrendChart games={manyOf(200)} />)
    const list = screen.getByLabelText('Every game this month, in order')
    expect(list.querySelectorAll('li')).toHaveLength(200)
  })

  it('keeps the line at a legible width even at 200 games', () => {
    const { container } = render(<GameTrendChart games={manyOf(200)} />)
    const width = Number(
      svg(container).querySelector('polyline')?.getAttribute('stroke-width') ?? NaN,
    )
    expect(width).toBeGreaterThanOrEqual(1.4)
  })

  it('keeps every point inside the 320-unit viewBox', () => {
    const { container } = render(<GameTrendChart games={manyOf(60)} />)
    const chart = svg(container)
    expect(chart.getAttribute('viewBox')).toBe('0 0 320 148')
    for (const c of chart.querySelectorAll('circle')) {
      const cx = Number(c.getAttribute('cx'))
      expect(cx).toBeGreaterThanOrEqual(0)
      expect(cx).toBeLessThanOrEqual(320)
    }
  })
})

describe('GameTrendChart accessibility', () => {
  it('hides the drawing from assistive tech and lists every game as text', () => {
    const games = [win(3), loss(), win(2)]
    const { container } = render(<GameTrendChart games={games} />)
    expect(svg(container).getAttribute('aria-hidden')).toBe('true')

    // Scoped to the list: the same sentences are also on the SVG <title>s,
    // which are hover tooltips and reach nobody using a keyboard.
    const list = screen.getByLabelText('Every game this month, in order')
    expect(list.querySelectorAll('li')).toHaveLength(3)
    expect(within(list).getByText('Game 1 of 3: solved in 3 guesses')).toBeDefined()
    expect(within(list).getByText('Game 2 of 3: not solved, all 6 guesses used')).toBeDefined()
  })

  it('gives every point a hover title as well', () => {
    const { container } = render(<GameTrendChart games={[win(1), loss()]} />)
    const titles = Array.from(svg(container).querySelectorAll('circle title')).map(
      (t) => t.textContent,
    )
    expect(titles).toEqual([
      'Game 1 of 2: solved in 1 guess',
      'Game 2 of 2: not solved, all 6 guesses used',
    ])
  })

  it('renders a visible caption carrying the same trend as the line', () => {
    render(<GameTrendChart games={[win(6), win(5), win(2), win(1)]} />)
    expect(screen.getByText(/trending better/)).toBeDefined()
  })
})

describe('summarizeTrend', () => {
  it('is empty for no games', () => {
    expect(summarizeTrend([])).toBe('')
  })

  it('reads as one game, not as a trend, for a single record', () => {
    expect(summarizeTrend([win(4)])).toBe('One game this month, solved in 4 guesses.')
    expect(summarizeTrend([loss()])).toBe('One game this month, not solved.')
  })

  it('counts solved and unsolved games', () => {
    const summary = summarizeTrend([win(3), loss(), win(4), loss()])
    expect(summary).toContain('4 games this month')
    expect(summary).toContain('2 solved, 2 not solved')
  })

  it('calls a falling guess count an improvement', () => {
    expect(summarizeTrend([win(6), win(6), win(2), win(2)])).toContain('trending better')
  })

  it('calls a rising guess count a decline', () => {
    expect(summarizeTrend([win(2), win(2), win(6), win(6)])).toContain('trending worse')
  })

  it('calls a flat run level', () => {
    expect(summarizeTrend([win(3), win(3), win(3), win(3)])).toContain('roughly level')
  })
})
