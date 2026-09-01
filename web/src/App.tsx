import { useCallback, useState } from 'react'
import { useGame, useStats } from './game/useGame'
import { GameScreen, ProgressScreen, RulesScreen } from './ui'

/** Which screen is showing. Three screens does not justify a router dependency. */
type Screen = 'game' | 'rules' | 'progress'

/**
 * Composition root: joins the coder's `useGame` hook to the designer's
 * presentational screens. The only file that knows about both halves.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>('game')
  const {
    state,
    onKeyPress,
    onDelete,
    onDeleteAtCursor,
    onMoveCursor,
    onSubmit,
    onNewGame,
    onErrorShown,
  } = useGame()

  // Rollups are read here rather than inside ProgressScreen so the screen stays
  // presentational; the hook re-reads storage when a game finishes.
  const stats = useStats()

  const backToGame = useCallback(() => { setScreen('game') }, [])

  // Starting a new game from the drawer should also return to the board.
  const startNewGame = useCallback(() => {
    onNewGame()
    setScreen('game')
  }, [onNewGame])

  if (screen === 'rules') return <RulesScreen onBack={backToGame} />

  if (screen === 'progress') {
    return (
      <ProgressScreen
        today={stats.today}
        thisWeek={stats.thisWeek}
        thisMonth={stats.thisMonth}
        onBack={backToGame}
      />
    )
  }

  return (
    <GameScreen
      rows={state.rows}
      keyStates={state.keypad}
      error={state.errorMessage}
      errorId={state.errorId}
      status={state.status}
      guessesUsed={state.guessesUsed}
      currentRow={state.currentRow}
      target={state.target}
      canSubmit={state.canSubmit}
      canDelete={state.canDelete}
      // Crossword-style entry: the caret can sit anywhere in the active row and
      // the row may hold gaps until all eight tiles are filled.
      cursor={state.cursor}
      onCursorMove={onMoveCursor}
      onDeleteAtCursor={onDeleteAtCursor}
      onKeyPress={onKeyPress}
      onDelete={onDelete}
      onSubmit={onSubmit}
      onNewGame={startNewGame}
      onErrorShown={onErrorShown}
      onOpenRules={() => { setScreen('rules') }}
      onOpenProgress={() => { setScreen('progress') }}
    />
  )
}
