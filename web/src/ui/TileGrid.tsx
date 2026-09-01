import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import {
  EQUATION_LENGTH,
  MAX_GUESSES,
  emptyRow,
  emptyTile,
} from '../game/types'
import type { Row, Tile, TileState } from '../game/types'
import { WinAnimation } from './WinAnimation'
import type { WinAnimationVariant } from './WinAnimation'
import { spokenChar, strings } from './strings'
import './TileGrid.css'

/** How a tile's state is spoken. Colour is never the only channel. */
function spokenState(state: TileState): string {
  switch (state) {
    case 'empty':
      return 'empty'
    case 'filled':
      return 'entered, not yet submitted'
    case 'correct':
      return 'correct, right position'
    case 'present':
      return 'present, wrong position'
    case 'absent':
      return 'not in the equation'
  }
}

function describeTile(tile: Tile, rowNumber: number, columnNumber: number): string {
  const char = tile.char
  const glyph = char === null ? '' : `${spokenChar(char)}, `
  return `Row ${rowNumber}, position ${columnNumber}, ${glyph}${spokenState(tile.state)}`
}

const REVEALED: readonly TileState[] = ['correct', 'present', 'absent']

export interface GuessTileProps {
  readonly tile: Tile
  /** 1-based column, used for the staggered reveal delay. */
  readonly column?: number
  /** Overrides the generated accessible name (the Rules colour key uses this). */
  readonly description?: string
  readonly rowNumber?: number
  /**
   * Supply this and the tile becomes a real button: focusable, clickable, with
   * a focus ring. Omit it — every row but the active one — and it renders as a
   * static image, with no hover and no pointer cursor, because clicking a
   * submitted row does nothing and must not look as though it might.
   */
  readonly onClick?: () => void
  /** True when the caret sits on this tile. Only ever one per board. */
  readonly caret?: boolean
  /**
   * Roving tab stop. The caret tile is the row's single tab stop (0); its
   * siblings are reachable with the arrow keys instead of eight Tab presses.
   */
  readonly tabIndex?: number
}

/**
 * One board cell. Fill, border and glyph colour are all driven by the tile
 * state; the same state is in the accessible name, so a screen reader gets the
 * information a sighted player gets from the colour. The caret is likewise
 * both drawn and spoken.
 */
export function GuessTile({
  tile,
  column = 1,
  rowNumber = 1,
  description,
  onClick,
  caret = false,
  tabIndex,
}: GuessTileProps) {
  const revealed = REVEALED.includes(tile.state)
  const interactive = onClick !== undefined
  const className = [
    'nd-tile',
    `nd-tile--${tile.state}`,
    revealed ? 'nd-tile--revealed' : '',
    interactive ? 'nd-tile--interactive' : '',
    caret ? 'nd-tile--caret' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const style = { '--nd-col': String(column - 1) } as CSSProperties
  const base = description ?? describeTile(tile, rowNumber, column)
  const body = (
    <>
      <span aria-hidden="true">{tile.char ?? ''}</span>
      {/* The caret bar. Drawn, not merely implied by a border colour, so it
          reads as a text cursor rather than as a fourth scoring state. */}
      {caret ? <span className="nd-tile__caret" aria-hidden="true" /> : null}
    </>
  )

  if (!interactive) {
    return (
      <div
        className={className}
        style={style}
        role="img"
        aria-label={caret ? `${base}, cursor here` : base}
      >
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={`${base}${caret ? ', cursor here' : ''}, press to type here`}
      // "location" is the aria-current token for "the current spot inside a
      // container", which is exactly what the caret marks.
      aria-current={caret ? 'location' : undefined}
      data-nd-caret={caret ? 'true' : undefined}
      tabIndex={tabIndex ?? 0}
      onClick={onClick}
    >
      {body}
    </button>
  )
}

export interface TileGridProps {
  /** The six board rows. Short arrays are padded, so previews stay honest. */
  readonly rows: readonly Row[]
  /**
   * Change this to fire a shake on [shakeRowIndex]. The value itself is
   * ignored, only the change matters: two identical rejections in a row must
   * still shake twice. A shake means "rejected, and your row is still yours".
   */
  readonly shakeTrigger: number
  /** Which row shakes. -1 for none. */
  readonly shakeRowIndex?: number
  /**
   * The row the player is typing into: the one that shows the caret, and the
   * only one whose tiles can be clicked. -1 (the default) makes the whole
   * board inert, which is what a finished game wants.
   */
  readonly activeRowIndex?: number
  /** Caret position within the active row, 0..7. */
  readonly cursor?: number
  /**
   * Clicking a tile in the active row moves the caret there. Omit it and the
   * active row still shows its caret but its tiles stay plain `div`s — a
   * control that cannot do anything must not advertise itself as one.
   */
  readonly onTileClick?: (rowIndex: number, colIndex: number) => void
  /** The winning row, for the celebration. -1 for none. */
  readonly winRowIndex?: number
  /** Which celebration to play, or null for none. */
  readonly winVariant?: WinAnimationVariant | null
  /** Fired when the celebration finishes or is tapped away. */
  readonly onWinAnimationDone?: () => void
}

export function TileGrid({
  rows,
  shakeTrigger,
  shakeRowIndex = -1,
  activeRowIndex = -1,
  cursor = 0,
  onTileClick,
  winRowIndex = -1,
  winVariant = null,
  onWinAnimationDone,
}: TileGridProps) {
  const board: Row[] = Array.from(
    { length: MAX_GUESSES },
    (_, i) => rows[i] ?? emptyRow(),
  )

  const shakeRef = useRef<HTMLDivElement | null>(null)
  const activeRowRef = useRef<HTMLDivElement | null>(null)
  const firstRun = useRef(true)

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const el = shakeRef.current
    if (el === null) return

    const clear = (): void => el.classList.remove('nd-grid__row--shake')
    clear()
    // Force a reflow so the animation restarts even when the class was already
    // there a moment ago.
    void el.offsetWidth
    el.classList.add('nd-grid__row--shake')
    el.addEventListener('animationend', clear, { once: true })
    return () => {
      el.removeEventListener('animationend', clear)
    }
  }, [shakeTrigger])

  /**
   * Keep DOM focus on the caret — but only when focus is already inside the
   * active row. A player typing on the keypad or reading the page must never
   * have focus yanked out from under them by a caret move.
   */
  useEffect(() => {
    const rowEl = activeRowRef.current
    if (rowEl === null) return
    const focused = document.activeElement
    if (!(focused instanceof HTMLElement) || !rowEl.contains(focused)) return
    const caretEl = rowEl.querySelector<HTMLElement>('[data-nd-caret="true"]')
    if (caretEl !== null && caretEl !== focused) caretEl.focus()
  }, [cursor, activeRowIndex])

  const showWin = winVariant !== null && winRowIndex >= 0

  return (
    <div className="nd-grid" role="group" aria-label={strings.boardDescription}>
      {board.map((row, rowIndex) => {
        const tiles: Tile[] = Array.from(
          { length: EQUATION_LENGTH },
          (_, i) => row.tiles[i] ?? emptyTile(),
        )
        const isActive = rowIndex === activeRowIndex
        const clickable = isActive && onTileClick !== undefined
        const isShakeRow = rowIndex === shakeRowIndex
        const setRef = (el: HTMLDivElement | null): void => {
          if (isShakeRow) shakeRef.current = el
          if (rowIndex === activeRowIndex) activeRowRef.current = el
        }
        return (
          <div
            key={rowIndex}
            className="nd-grid__row"
            ref={setRef}
            data-nd-win={showWin && rowIndex === winRowIndex ? winVariant : undefined}
          >
            {tiles.map((tile, colIndex) => {
              const isCaret = isActive && colIndex === cursor
              if (!clickable || onTileClick === undefined) {
                return (
                  <GuessTile
                    key={colIndex}
                    tile={tile}
                    rowNumber={rowIndex + 1}
                    column={colIndex + 1}
                    caret={isCaret}
                  />
                )
              }
              return (
                <GuessTile
                  key={colIndex}
                  tile={tile}
                  rowNumber={rowIndex + 1}
                  column={colIndex + 1}
                  caret={isCaret}
                  // Roving tab stop: the caret tile is the row's single stop.
                  tabIndex={isCaret ? 0 : -1}
                  onClick={() => {
                    onTileClick(rowIndex, colIndex)
                  }}
                />
              )
            })}
          </div>
        )
      })}

      {showWin && winVariant !== null ? (
        <WinAnimation
          variant={winVariant}
          rowIndex={winRowIndex}
          onDone={onWinAnimationDone ?? (() => undefined)}
        />
      ) : null}
    </div>
  )
}
