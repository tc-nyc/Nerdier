/** Barrel for the UI layer — the only thing App.tsx needs to import from. */
export { GameScreen } from './GameScreen'
export type { GameScreenProps } from './GameScreen'
export { RulesScreen } from './RulesScreen'
export type { RulesScreenProps } from './RulesScreen'
export { ProgressScreen, emptyPeriodStats, formatAverageGuesses } from './ProgressScreen'
export type { PeriodStats, ProgressScreenProps } from './ProgressScreen'
export { TileGrid, GuessTile } from './TileGrid'
export type { TileGridProps, GuessTileProps } from './TileGrid'
export {
  WinAnimation,
  randomWinVariant,
  WIN_ANIMATION_VARIANTS,
  WIN_ANIMATION_MS,
  WIN_ANIMATION_REDUCED_MS,
} from './WinAnimation'
export type { WinAnimationProps, WinAnimationVariant } from './WinAnimation'
export { KathrynEasterEgg, VerificationFailedAnimation, KATHRYN_ANIMATION_MS } from './KathrynEasterEgg'
export type {
  KathrynEasterEggProps,
  VerificationFailedAnimationProps,
} from './KathrynEasterEgg'
export { Keypad } from './Keypad'
export type { KeypadProps } from './Keypad'
export { ErrorBanner } from './ErrorBanner'
export type { ErrorBannerProps } from './ErrorBanner'
export { GuessDistributionChart } from './GuessDistributionChart'
export type { GuessDistributionChartProps } from './GuessDistributionChart'
export { GameTrendChart } from './GameTrendChart'
export type { GameTrendChartProps, TrendGame } from './GameTrendChart'
export { strings } from './strings'
