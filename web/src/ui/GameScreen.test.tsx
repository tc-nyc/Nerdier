/**
 * @vitest-environment jsdom
 *
 * Wiring cover for the board screen: that the caret reaches the grid, that the
 * celebration plays on a win and *only* on a win, and that a finished board
 * stops offering tiles to click.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GameScreen } from './GameScreen'
import { emptyBoard } from '../game/types'
import type { Row } from '../game/types'
import type { GameScreenProps } from './GameScreen'

afterEach(cleanup)

const solved: Row = {
  tiles: '12+34=46'.split('').map((c) => ({ char: c, state: 'correct' as const })),
}

const base = {
  keyStates: {},
  error: null,
  errorId: 0,
  target: null,
  onKeyPress: vi.fn(),
  onDelete: vi.fn(),
  onSubmit: vi.fn(),
  onNewGame: vi.fn(),
  onOpenRules: vi.fn(),
  onOpenProgress: vi.fn(),
} satisfies Partial<GameScreenProps>

describe('GameScreen', () => {
  it('puts the caret where the hook says, and makes the active row clickable', () => {
    render(
      <GameScreen
        {...base}
        rows={emptyBoard()}
        status="in-progress"
        guessesUsed={0}
        cursor={3}
        onCursorMove={vi.fn()}
      />,
    )
    expect(
      screen.getByLabelText('Row 1, position 4, empty, cursor here, press to type here'),
    ).toBeTruthy()
    expect(document.querySelectorAll('.nd-tile--interactive')).toHaveLength(8)
  })

  it('celebrates over the winning row, and stops offering tiles to click', () => {
    render(
      <GameScreen
        {...base}
        rows={[solved, ...emptyBoard().slice(1)]}
        status="won"
        guessesUsed={1}
      />,
    )
    const win = document.querySelector('.nd-win')
    expect(win).not.toBeNull()
    // Row 1 won, so the effect layer parks itself over row index 0.
    expect(win?.getAttribute('style')).toContain('--nd-win-row: 0')
    expect(document.querySelectorAll('.nd-tile--interactive')).toHaveLength(0)
  })

  it('does not celebrate a loss', () => {
    render(
      <GameScreen
        {...base}
        rows={[solved, ...emptyBoard().slice(1)]}
        status="lost"
        guessesUsed={6}
        target="12+34=46"
      />,
    )
    expect(document.querySelector('.nd-win')).toBeNull()
  })
})
