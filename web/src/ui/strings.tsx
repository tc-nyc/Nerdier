/**
 * Every player-facing string, in one place.
 *
 * Copied verbatim from the Android build's `res/values/strings.xml` so the two
 * clients say exactly the same thing. Placeholders that were `%1$d` / `%1$s`
 * there are functions here.
 */
export const strings = {
  appName: 'Nerdier',

  /* Chrome */
  actionOpenMenu: 'Open menu',
  actionOpenProgress: 'Open progress and statistics',
  actionBack: 'Back',
  actionCloseMenu: 'Close menu',
  drawerHeading: 'Nerdier',
  drawerSubheading: 'Guess the equation in six tries',
  drawerNewGame: 'New Game',
  drawerRules: 'How to Play',

  /* Game board */
  boardDescription: 'Guess board, six rows of eight tiles',
  gameWon: (guesses: number): string => `Solved in ${guesses} of 6 guesses.`,
  gameLost: (target: string): string => `Out of guesses. The equation was ${target}.`,
  gamePlayAgain: 'Play again',
  gameGuessesRemaining: (n: number): string => `Guess ${n} of 6`,
  /** Spoken caret position. Sighted players get the cyan bar; this is the rest. */
  gameCursorAt: (n: number): string => `Cursor at position ${n} of 8`,

  /* Rules */
  rulesTitle: 'How to Play',
  rulesIntro:
    'Guess the hidden equation in six tries. Every guess must itself be a true equation.',

  rulesHFormat: 'The format',
  rulesFormat: [
    'Every equation is exactly 8 tiles long.',
    'It contains exactly one equals sign.',
    'Operators (plus, minus, times, divide) appear only to the left of the equals sign.',
    'The answer on the right is a whole number of 1 to 3 digits.',
    'No leading zeros. 05+3=08 is not a valid equation.',
  ],

  rulesHMaths: 'The maths',
  rulesMaths: [
    'Standard order of operations applies. Multiplication and division resolve before addition and subtraction, so 2+3*4=14, not 20.',
    'Division must come out whole. 7/2 is rejected.',
    'No multiplying by zero. 0*7=0 and 7*0=0 are rejected, and so is a times-zero buried further in, like 4+92*0=4. It is the value of the operand that counts, not the character beside the sign.',
    'No dividing zero either. 0/1234=0 is rejected, as is any division whose left-hand side works out to zero. Dividing by zero was never possible in the first place; this is the other side of the slash.',
    'The digit 0 itself is not banned. 10-0-4=6 and 5-0+9=14 both stand, and a 0 inside a longer number is never a problem: 9*40=360 and 20*5=100 are perfectly good equations.',
    'Nothing may go negative, including intermediate steps. 5-8+4=1 is rejected, because 5-8 dips below zero on the way.',
  ],

  rulesHColours: 'The colours',
  rulesColourGreen: 'Green: right character, right position.',
  rulesColourPurple: 'Purple: that character is in the equation, but not in that spot.',
  rulesColourBlack:
    'Black: that character is not in the equation at all, or every copy of it is already accounted for by a green or purple tile elsewhere in the row.',
  rulesColourNote:
    'Repeats follow the Wordle rule. If the answer holds one 3 and you play two, only one of yours gets coloured.',

  rulesHWinning: 'Winning',
  rulesWinning: [
    'A commutative reordering still wins. If the hidden equation is 3+5=8 and you guess 5+3=8, that is a win. Your tiles may not all be green, and you win anyway.',
    'Only addition and multiplication reorder freely. Subtraction and division depend on order, so 8-3=5 is not the same guess as 3-8=5.',
    'An invalid guess does not cost you a row. The row shakes, an explanation appears above the board, and your tiles stay put so you can edit and resubmit.',
  ],

  /* The Kathryn easter egg, in the Winning section. The bullet keeps the
   * section's voice; the button under it makes the claim, and the app rejects
   * it. Wording is the principal's, verbatim. */
  rulesWinningKathryn: 'If Kathryn starts drinking coffee, she wins the game.',
  rulesKathrynActivator: 'Kathryn drank coffee',
  rulesKathrynFailure: "Verification failed, Kathryn doesn't drink coffee",

  /* Win celebration. The wordmark the `nerdiest` variant shows, and the one
   * every variant falls back to under prefers-reduced-motion. On an iPhone the
   * `nerdiest` variant says something else — the principal's joke, verbatim. */
  winWordmark: 'You are the Nerdiest',
  winWordmarkIPhone: 'Kathryn won, without drinking coffee!',

  /* Progress */
  progressTitle: 'Progress',
  progressToday: 'Today',
  progressThisWeek: 'This Week',
  progressThisMonth: 'This Month',
  progressEmpty: 'No games played in this period yet.',
  statPlayed: 'Played',
  statWon: 'Won',
  statAvgGuesses: 'Avg guesses',
  statWinRate: 'Win rate',
  statStreak: 'Streak',
  /** Stated in the UI because the definition is not self-evident from the label. */
  statAvgGuessesNote: 'Avg guesses is the mean over solved games only; losses are excluded.',
  /** Spoken in place of the em dash, which a screen reader would skip or mangle. */
  statAvgGuessesNone: 'no solved games yet',
  progressDistribution: 'Guess distribution',
  progressTrend: 'Guesses per game',
} as const

/** Spoken form of a board character, so a screen reader never says "asterisk". */
export function spokenChar(c: string): string {
  switch (c) {
    case '+':
      return 'plus'
    case '-':
      return 'minus'
    case '*':
      return 'times'
    case '/':
      return 'divided by'
    case '=':
      return 'equals'
    default:
      return c
  }
}
