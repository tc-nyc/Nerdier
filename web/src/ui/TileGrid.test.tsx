/**
 * @vitest-environment jsdom
 *
 * Cover for the clickable board: which tiles are controls, where the caret is,
 * and that a row full of holes still renders.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TileGrid } from './TileGrid'
import { EQUATION_LENGTH, emptyRow, emptyTile } from '../game/types'
import type { Row, Tile } from '../game/types'

afterEach(cleanup)

/** `.` marks a gap. Anything else is a typed, unsubmitted character. */
const rowOf = (pattern: string): Row => ({
  tiles: Array.from({ length: EQUATION_LENGTH }, (_unused, i): Tile => {
    const c = pattern[i]
    return c === undefined || c === '.' ? emptyTile() : { char: c, state: 'filled' }
  }),
})

const scoredRow = (text: string): Row => ({
  tiles: Array.from({ length: EQUATION_LENGTH }, (_unused, i): Tile => ({
    char: text[i] ?? '0',
    state: 'absent',
  })),
})

describe('TileGrid caret and tile clicks', () => {
  it('makes only the active row clickable', () => {
    render(
      <TileGrid
        rows={[scoredRow('12+34=46'), emptyRow()]}
        shakeTrigger={0}
        activeRowIndex={1}
        cursor={0}
        onTileClick={vi.fn()}
      />,
    )
    // Eight buttons, all of them in row 2.
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(EQUATION_LENGTH)
    for (const b of buttons) {
      expect(b.getAttribute('aria-label')).toMatch(/^Row 2, /)
    }
    // The submitted row is still readable, just not operable.
    expect(screen.getByLabelText(/^Row 1, position 1,/).tagName).toBe('DIV')
  })

  it('reports the row and column that were clicked', () => {
    const onTileClick = vi.fn()
    render(
      <TileGrid
        rows={[emptyRow()]}
        shakeTrigger={0}
        activeRowIndex={0}
        cursor={0}
        onTileClick={onTileClick}
      />,
    )
    fireEvent.click(screen.getByLabelText(/^Row 1, position 6,/))
    expect(onTileClick).toHaveBeenCalledTimes(1)
    expect(onTileClick).toHaveBeenCalledWith(0, 5)
  })

  it('marks the caret tile with aria-current and gives it the row s only tab stop', () => {
    render(
      <TileGrid
        rows={[emptyRow()]}
        shakeTrigger={0}
        activeRowIndex={0}
        cursor={4}
        onTileClick={vi.fn()}
      />,
    )
    const caret = screen.getByLabelText(/^Row 1, position 5,.*cursor here/)
    expect(caret.getAttribute('aria-current')).toBe('location')
    expect(caret.tabIndex).toBe(0)

    const other = screen.getByLabelText(/^Row 1, position 2,/)
    expect(other.getAttribute('aria-current')).toBeNull()
    expect(other.tabIndex).toBe(-1)

    // Exactly one caret on the board.
    expect(screen.getAllByText((_content, el) => el?.className === 'nd-tile__caret')).toHaveLength(1)
  })

  it('renders a row with gaps: a character at position 6 and nothing either side', () => {
    render(
      <TileGrid
        rows={[rowOf('.....7..')]}
        shakeTrigger={0}
        activeRowIndex={0}
        cursor={5}
        onTileClick={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/^Row 1, position 6, 7, entered, not yet submitted/)).toBeTruthy()
    expect(screen.getByLabelText(/^Row 1, position 5, empty/)).toBeTruthy()
    expect(screen.getByLabelText(/^Row 1, position 7, empty/)).toBeTruthy()
  })

  it('still draws the caret, but no controls, when no click handler is supplied', () => {
    render(<TileGrid rows={[emptyRow()]} shakeTrigger={0} activeRowIndex={0} cursor={2} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByLabelText(/^Row 1, position 3, empty, cursor here$/)).toBeTruthy()
  })

  it('is inert once the game is over', () => {
    render(<TileGrid rows={[scoredRow('12+34=46')]} shakeTrigger={0} activeRowIndex={-1} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
