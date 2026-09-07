import { useEffect, useRef, useState } from 'react'
import {
  MAX_GUESSES,
  clampCursor,
  emptyRow,
  filledCount,
  isRowComplete,
} from '../game/types'
import type { GameStatus, Row, TileState } from '../game/types'
import { ErrorBanner } from './ErrorBanner'
import { BarChartIcon, InfoIcon, MenuIcon, RefreshIcon } from './Icons'
import { Keypad } from './Keypad'
import { TileGrid } from './TileGrid'
import { randomWinVariant } from './WinAnimation'
import type { WinAnimationVariant } from './WinAnimation'
import { strings } from './strings'
import './Chrome.css'
import './GameScreen.css'

export interface GameScreenProps {
  /** The six board rows; the player edits row [currentRow]. */
  readonly rows: readonly Row[]
  /** Best-known state per keypad character. */
  readonly keyStates: Readonly<Record<string, TileState>>
  /** Transient validator message, or null. */
  readonly error: string | null
  readonly status: GameStatus
  readonly guessesUsed: number
  /** Revealed only once the game is lost. */
  readonly target: string | null
  /**
   * Nonce that changes on every new validator error. A change shakes the
   * active row. The message alone would not do: two identical rejections in a
   * row must still shake twice.
   */
  readonly errorId: number
  /** Caret position in the active row, 0..7. */
  readonly cursor?: number
  readonly onKeyPress: (char: string) => void
  readonly onDelete: () => void
  /** Forward delete — clears the tile at the caret. Wire to `onDeleteAtCursor`. */
  readonly onDeleteAtCursor?: () => void
  /**
   * What the on-screen DELETE button does: clear the caret's tile if it holds
   * a character, otherwise backspace. Passed straight to {@link Keypad}, which
   * falls back to `onDeleteAtCursor` then `onDelete` when it is absent.
   */
  readonly onDeleteAtSelection?: () => void
  /**
   * Move the caret to an absolute position. Fired by tapping a tile in the
   * active row and by the left/right arrow keys.
   */
  readonly onCursorMove?: (index: number) => void
  readonly onSubmit: () => void
  readonly onNewGame: () => void
  readonly onOpenRules: () => void
  readonly onOpenProgress: () => void
  /**
   * Called once the error has been on screen long enough to read, so the hook
   * can clear it. Omit it and the banner stays until the state changes.
   */
  readonly onErrorShown?: () => void
  /** Index of the row being edited. Defaults to `guessesUsed`. */
  readonly currentRow?: number
  /** Overrides the derived value; pass the hook's own flag when you have it. */
  readonly canSubmit?: boolean
  readonly canDelete?: boolean
  /** Enables the on-screen DELETE button; defaults to `canDelete`'s value. */
  readonly canDeleteAtSelection?: boolean
}

/** How long a validator message stays up before `onErrorShown` fires. */
const ERROR_VISIBLE_MS = 2600

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

export function GameScreen({
  rows,
  keyStates,
  error,
  status,
  guessesUsed,
  target,
  errorId,
  cursor = 0,
  onKeyPress,
  onDelete,
  onDeleteAtCursor,
  onDeleteAtSelection,
  onCursorMove,
  onSubmit,
  onNewGame,
  onOpenRules,
  onOpenProgress,
  onErrorShown,
  currentRow,
  canSubmit,
  canDelete,
  canDeleteAtSelection,
}: GameScreenProps) {
  // The only state this screen owns is presentational.
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Which celebration is playing. Drawn once, when the game is won, and
  // cleared five seconds later or on the first tap — see WinAnimation.
  const [winVariant, setWinVariant] = useState<WinAnimationVariant | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const firstDrawerItemRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!drawerOpen) return
    firstDrawerItemRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen])

  // A win — and only a win — draws one of the five. A loss gets nothing.
  useEffect(() => {
    setWinVariant(status === 'won' ? randomWinVariant() : null)
  }, [status, guessesUsed])

  const closeDrawer = (): void => {
    setDrawerOpen(false)
    menuButtonRef.current?.focus()
  }

  // The banner is transient: show it, then hand control back to the hook.
  useEffect(() => {
    if (error === null || onErrorShown === undefined) return
    const id = window.setTimeout(onErrorShown, ERROR_VISIBLE_MS)
    return () => {
      window.clearTimeout(id)
    }
  }, [error, errorId, onErrorShown])

  const inProgress = status === 'in-progress'
  const activeRowIndex = clamp(currentRow ?? guessesUsed, 0, MAX_GUESSES - 1)
  const activeRow: Row = rows[activeRowIndex] ?? emptyRow()
  // Completeness, never `rowText().length`: the row may hold gaps now, and a
  // row with a hole reads short but must not be submittable.
  const submitEnabled = canSubmit ?? (inProgress && isRowComplete(activeRow))
  const deleteEnabled = canDelete ?? (inProgress && filledCount(activeRow) > 0)
  const caret = clampCursor(cursor)

  const moveCaret = (index: number): void => {
    onCursorMove?.(clampCursor(index))
  }

  // The winning row is the last one submitted.
  const winRowIndex = clamp(guessesUsed - 1, 0, MAX_GUESSES - 1)

  const gameOverMessage =
    status === 'won'
      ? strings.gameWon(guessesUsed)
      : status === 'lost'
        ? strings.gameLost(target ?? '')
        : ''

  return (
    <div className="nd-screen">
      <header className="nd-appbar">
        <button
          type="button"
          className="nd-iconbutton"
          aria-label={strings.actionOpenMenu}
          aria-expanded={drawerOpen}
          ref={menuButtonRef}
          onClick={() => setDrawerOpen(true)}
        >
          <MenuIcon />
        </button>
        <h1 className="nd-appbar__title nd-appbar__title--center">{strings.appName}</h1>
        <button
          type="button"
          className="nd-iconbutton"
          aria-label={strings.actionOpenProgress}
          onClick={onOpenProgress}
        >
          <BarChartIcon />
        </button>
      </header>

      <div className="nd-screen__body">
        <ErrorBanner message={error} />

        <div className="nd-screen__board">
          <TileGrid
            rows={rows}
            shakeRowIndex={activeRowIndex}
            shakeTrigger={errorId}
            activeRowIndex={inProgress ? activeRowIndex : -1}
            cursor={caret}
            {...(onCursorMove === undefined
              ? {}
              : {
                  onTileClick: (_rowIndex: number, colIndex: number) => {
                    moveCaret(colIndex)
                  },
                })}
            winRowIndex={status === 'won' ? winRowIndex : -1}
            winVariant={winVariant}
            onWinAnimationDone={() => {
              setWinVariant(null)
            }}
          />
        </div>

        {!inProgress ? (
          <div className="nd-gameover">
            <p className="nd-gameover__message" role="status" aria-live="polite">
              {gameOverMessage}
            </p>
            <button type="button" className="nd-button" onClick={onNewGame}>
              {strings.gamePlayAgain}
            </button>
          </div>
        ) : (
          <p className="nd-visually-hidden" role="status" aria-live="polite">
            {`${strings.gameGuessesRemaining(
              Math.min(activeRowIndex + 1, MAX_GUESSES),
            )}. ${strings.gameCursorAt(caret + 1)}`}
          </p>
        )}

        <div className="nd-screen__keypad">
          <Keypad
            keyStates={keyStates}
            onKeyPress={onKeyPress}
            onDelete={onDelete}
            {...(onDeleteAtCursor === undefined ? {} : { onDeleteAtCursor })}
            {...(onDeleteAtSelection === undefined ? {} : { onDeleteAtSelection })}
            {...(canDeleteAtSelection === undefined ? {} : { canDeleteAtSelection })}
            onArrow={(direction) => {
              moveCaret(direction === 'left' ? caret - 1 : caret + 1)
            }}
            onSubmit={onSubmit}
            canSubmit={submitEnabled}
            canDelete={deleteEnabled}
            enabled={inProgress}
            keyboardEnabled={!drawerOpen}
          />
        </div>
      </div>

      {drawerOpen ? (
        <>
          <button
            type="button"
            className="nd-scrim"
            aria-label={strings.actionCloseMenu}
            onClick={closeDrawer}
          />
          <nav className="nd-drawer" aria-label={strings.drawerHeading}>
            <div className="nd-drawer__head">
              <h2>{strings.drawerHeading}</h2>
              <p>{strings.drawerSubheading}</p>
            </div>
            <div className="nd-drawer__divider" />
            <button
              type="button"
              className="nd-drawer__item"
              ref={firstDrawerItemRef}
              onClick={() => {
                closeDrawer()
                onNewGame()
              }}
            >
              <RefreshIcon size={22} />
              {strings.drawerNewGame}
            </button>
            <button
              type="button"
              className="nd-drawer__item"
              onClick={() => {
                closeDrawer()
                onOpenRules()
              }}
            >
              <InfoIcon size={22} />
              {strings.drawerRules}
            </button>
          </nav>
        </>
      ) : null}
    </div>
  )
}
