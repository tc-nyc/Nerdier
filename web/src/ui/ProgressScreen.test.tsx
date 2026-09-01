/**
 * @vitest-environment jsdom
 *
 * The Progress screen's headline cells, and which period gets which chart.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ProgressScreen, emptyPeriodStats, formatAverageGuesses } from './ProgressScreen'
import type { PeriodStats } from './ProgressScreen'

afterEach(cleanup)

const stats = (over: Partial<PeriodStats> = {}): PeriodStats => ({
  ...emptyPeriodStats,
  ...over,
})

const renderScreen = (over: {
  today?: PeriodStats
  thisWeek?: PeriodStats
  thisMonth?: PeriodStats
}) =>
  render(
    <ProgressScreen
      today={over.today ?? emptyPeriodStats}
      thisWeek={over.thisWeek ?? emptyPeriodStats}
      thisMonth={over.thisMonth ?? emptyPeriodStats}
      onBack={vi.fn()}
    />,
  )

describe('formatAverageGuesses', () => {
  it('shows one decimal place', () => {
    expect(formatAverageGuesses(3.75)).toBe('3.8')
    expect(formatAverageGuesses(4)).toBe('4.0')
  })

  it('renders the no-wins sentinel as an em dash, never as 0.0', () => {
    expect(formatAverageGuesses(0)).toBe('—')
  })

  it('does not let a NaN or a negative reach the screen', () => {
    expect(formatAverageGuesses(Number.NaN)).toBe('—')
    expect(formatAverageGuesses(-1)).toBe('—')
  })
})

describe('ProgressScreen headline cells', () => {
  it('shows Played, Avg guesses, Win rate and Streak — and not Won', () => {
    renderScreen({ today: stats({ played: 5, won: 4, winPercent: 80, currentStreak: 2 }) })
    const card = screen.getByLabelText('Today')
    expect(within(card).getByText('Played')).toBeDefined()
    expect(within(card).getByText('Avg guesses')).toBeDefined()
    expect(within(card).getByText('Win rate')).toBeDefined()
    expect(within(card).getByText('Streak')).toBeDefined()
    expect(within(card).queryByText('Won')).toBeNull()
  })

  it('formats the average to one decimal place', () => {
    renderScreen({ today: stats({ played: 3, won: 2, averageGuesses: 10 / 3 }) })
    const card = screen.getByLabelText('Today')
    expect(within(card).getByText('3.3')).toBeDefined()
  })

  it('shows an em dash, and says "no solved games yet", when the period has no wins', () => {
    renderScreen({ today: stats({ played: 2, won: 0, averageGuesses: 0 }) })
    const card = screen.getByLabelText('Today')
    expect(within(card).getByText('—')).toBeDefined()
    expect(
      within(card).getByLabelText(/Avg guesses: no solved games yet/),
    ).toBeDefined()
  })

  it('states the solved-games-only definition on screen', () => {
    renderScreen({})
    expect(
      screen.getByText(/mean over solved games only; losses are excluded/),
    ).toBeDefined()
  })
})

describe('ProgressScreen charts', () => {
  const games = [
    { won: true, guessesUsed: 3 },
    { won: false, guessesUsed: 6 },
    { won: true, guessesUsed: 2 },
  ]

  it('gives This Month the per-game trend and the other two the histogram', () => {
    renderScreen({
      today: stats({ played: 1, won: 1, guessDistribution: [0, 0, 1, 0, 0, 0] }),
      thisWeek: stats({ played: 1, won: 1, guessDistribution: [0, 0, 1, 0, 0, 0] }),
      thisMonth: stats({ played: 3, won: 2, games, guessDistribution: [0, 1, 1, 0, 0, 0] }),
    })

    const month = screen.getByLabelText('This Month')
    expect(within(month).getByText('Guesses per game')).toBeDefined()
    expect(month.querySelector('.nd-trend')).not.toBeNull()
    expect(month.querySelector('.nd-chart')).toBeNull()

    const today = screen.getByLabelText('Today')
    expect(within(today).getByText('Guess distribution')).toBeDefined()
    expect(today.querySelector('.nd-chart')).not.toBeNull()
    expect(today.querySelector('.nd-trend')).toBeNull()
  })

  it('falls back to the empty state for a month with no games', () => {
    renderScreen({})
    const month = screen.getByLabelText('This Month')
    expect(within(month).getByText('No games played in this period yet.')).toBeDefined()
    expect(month.querySelector('svg')).toBeNull()
  })
})
