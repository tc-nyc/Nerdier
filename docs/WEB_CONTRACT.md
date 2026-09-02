# Nerdier Web — Shared Contract (owned by senior-developer)

React 19 · TypeScript 5.9 (strict) · Vite 7 · Vitest 3 · PWA · deploys to
Azure Static Web Apps (free tier). **No backend** — the game is entirely
client-side and stats live in `localStorage`.

## File ownership — DISJOINT. Do not write outside your column.

| math-wizard | coder | game-designer | senior-developer |
|---|---|---|---|
| `src/game/equation.ts` | `src/game/scorer.ts` | `src/ui/*.tsx` | `src/game/types.ts` |
| `src/game/equation.test.ts` | `src/game/engine.ts` | `src/ui/*.css` | `src/main.tsx`, `src/App.tsx` |
| | `src/game/stats.ts` | `src/styles.css` | `vite.config.ts`, `tsconfig.json` |
| | `src/game/storage.ts` | | `index.html`, `public/*` |
| | `src/game/useGame.ts` | | Azure config + CI |
| | `src/game/*.test.ts` | | |

`src/game/types.ts` is written ONCE, by the senior developer. Everyone imports
from it. Nobody edits it without asking.

## Interfaces

**math-wizard provides** (`src/game/equation.ts`):
```ts
export function generateEquation(rng?: () => number): string
export function validateEquation(guess: string): ValidationResult
export function evaluateExpression(expr: string): number | null   // LHS only; null if unevaluable
export function isCommutativelyEquivalent(a: string, b: string): boolean
```

**coder provides**:
```ts
// scorer.ts
export function score(guess: string, target: string): Tile[]
export function updateKeypad(current: Record<string, TileState>, tiles: readonly Tile[]): Record<string, TileState>
// engine.ts — pure, no React
export class GameEngine { ... }
// stats.ts / storage.ts — localStorage-backed, same rollups as Android
export function summarize(records, period, nowMillis): StatsSummary
// useGame.ts — the React hook the UI consumes
export function useGame(): { state: GameUiState; onKeyPress; onDelete; onSubmit; onNewGame }
```

**game-designer consumes** both; never mutates game state directly.

## Non-negotiable rules (unchanged from the Android build)
1. 8 chars, exactly one `=`, operators LHS-only, RHS is 1–3 digits.
2. Integer math only, exact division, no negatives incl. intermediates,
   no leading zeros, standard operator precedence.
3. Scoring is TWO-PASS with character-count budgeting, applied to digits,
   operators and `=` alike.
4. An invalid guess does NOT consume a row.
5. A win may be commutative — do NOT infer "won" from "all tiles green".
   Commutativity is STRICT: only `+` and `*` operands reorder. `8-3=5` is not
   equivalent to `3-8=5`.
6. No new runtime dependencies without senior-developer approval. There is no
   backend and none is to be added.

## Reference implementation
The Kotlin under `android/` is the reference. `android/app/src/test/` holds 54
passing tests whose cases should be carried across, especially the
duplicate-character scoring matrix and the week/month bucket boundaries.

---

# Addendum — free cursor + win animation (principal's request)

## A. Type anywhere, gaps allowed

The principal chose crossword-style entry over the no-gaps model. The active row
is therefore **no longer a contiguous string**.

**Cursor semantics** (senior developer's spec — implement exactly):
- The active row has a `cursor`, an index `0..7`. It starts at 0.
- Clicking **any tile in the active row** moves the cursor there, blank or not.
  Clicking a tile in a *submitted* row does nothing.
- Typing a character writes it at the cursor, **overwriting whatever is there**,
  then advances the cursor by 1 (stopping at 7 — it does not wrap).
- **Backspace** clears the character at `cursor - 1` and moves the cursor there.
  When the cursor is at 0, it clears position 0 and stays. **Delete** clears the
  character *at* the cursor without moving.
- **ArrowLeft / ArrowRight** move the cursor one position, clamped at the ends.
- A row may hold gaps at any time. **Enter is enabled only when all 8 positions
  are filled** (`isRowComplete`). Submitting an incomplete row must fail with the
  existing "fill all 8 tiles" message and must not consume a guess.
- Starting a new row (after a valid submit) or a new game resets the cursor to 0.

**`rowText` is now display-only.** It skips gaps, so using it to build a guess
would submit a different equation from the one on screen. Use `rowEquation(row)`,
which returns `null` unless the row is complete. This is the single most likely
bug in this change — the senior developer will review for it specifically.

## B. Win animation

On a **win only** (not a loss), play one animation chosen at random from five,
lasting **5 seconds**, after which the board is simply left as it is. No summary
card, no overlay remains — the principal chose "return to the finished board".

The five, all pure CSS, no images and no libraries:
1. **Jump** — winning row hops in a staggered wave.
2. **Flames** — fire licks up over the winning row with embers.
3. **Confetti** — coloured pieces burst from the winning row and fall.
4. **Spin** — tiles spin on their axis in sequence, then settle.
5. **Nerdiest** — the screen flashes black and white with the words
   **"You are the Nerdiest"**.

**Safety requirement on #5, non-negotiable:** rapid full-screen luminance
flashing can trigger photosensitive seizures. Cap it at **3 flashes per second
or fewer** (WCAG 2.3.1), and never use fully saturated red. Keep the contrast
between the two states well short of pure `#000`↔`#fff` at speed.

**All five** must be disabled under `prefers-reduced-motion: reduce` — show a
brief static "You are the Nerdiest" instead, with no flashing, no motion.

The animation must not block input: the player can still open the menu, and
tapping anywhere dismisses it early.

---

# Addendum 2 — stats and tile tweaks (principal's request)

## A. Unused tiles are white

Tiles in the `empty` state get a **white fill** in both light and dark themes,
replacing today's transparent/outline-only treatment. Only `empty` — a
`filled` (typed, unsubmitted) tile is not "unused" and keeps its current look.

Consequences to handle rather than ignore:
- In dark mode a grid of white tiles is bright. Keep the border so the grid
  still reads as a grid, and make sure the caret is still clearly visible
  against white in both themes.
- Whatever sits on a white tile must have dark enough text/marks to stay
  legible. Check the caret bar and any focus ring.

## B. Stats cells: drop "Won", add average guesses

Each period's headline row currently reads **Played / Won / Win rate / Streak**.
Replace **Won** with **Avg guesses**. Order: Played / Avg guesses / Win rate /
Streak.

**Definition (senior developer's call — state it in the UI):** the mean number
of guesses over **solved games only**. Losses are excluded, because a loss
consumed six guesses without solving anything and folding that in makes the
number describe stamina rather than skill. Show it to **one decimal place**.
With no wins in the period, show an em dash `—`, not `0.0`.

`StatsSummary` gains `readonly averageGuesses: number` (0 when there are no
wins; the UI decides how to render that as `—`).

## C. "This Month" distribution becomes a line chart

**Only the This Month section.** Today and This Week keep the existing bar
histogram.

Replace the histogram with a **line chart of the month's games in
chronological order**: x = each game played (1st, 2nd, 3rd… of the month),
y = guesses used, y-axis fixed 1..6 with 1 at the top (fewer guesses is
better, so a lower line is a worse result — label the axis so this is not
ambiguous).

- Plot **every** game in the month, wins and losses. Mark losses distinctly
  (e.g. a hollow or differently-coloured point) since a loss is "6 guesses but
  unsolved" and would otherwise read as a bad-but-successful game.
- Pure CSS/SVG. No charting library.
- Handle the degenerate cases: zero games (empty state message), and exactly
  one game (a single point, no line).
- It must stay readable at 320px wide. With many games, do not let points
  collapse into mush — thin the point markers, keep the line.
- Accessible: the chart needs a text alternative conveying the same trend, and
  each point needs a reachable label.

`StatsSummary` gains `readonly games: readonly GameRecord[]` — the in-period
records, chronological — so the chart has per-game data rather than the rollup.

---

# Addendum 3 — unused keypad keys are white (principal's correction)

The principal's "unused tiles should be white" meant the **keypad at the bottom**,
not (or not only) the board grid. They have confirmed they like the board as it
now stands, so **leave the board alone** and apply the same treatment to the
keypad.

**Scope:** the character keys `0`–`9`, `+`, `-`, `*`, `/`, `=` in their
*not yet tried* state get a **white fill** in both light and dark themes.

- Keys that have been used keep their green / purple / black scored fill — the
  monotonic keypad colouring is untouched.
- **ENTER and DELETE are not character keys and do not change.** They are
  actions, not letters.
- The glyph on a white key must be dark enough to read: in dark mode the key
  label is currently a light colour and would vanish. Flip it and state the
  measured contrast.
- Keep a visible border so the keys still read as distinct controls against a
  light page, exactly as was done for the board's empty tiles.
- Re-check `:focus-visible` and any hover/active state against white.
- The disabled look for ENTER must remain distinguishable from a white
  character key.

---

# Addendum 4 — the Kathryn easter egg (principal's request)

A joke, in the **How to Play** screen's *Winning* section.

1. A new bullet, in the same voice as its neighbours, reading essentially:
   **"If Kathryn starts drinking coffee, she wins the game."**
2. Immediately after it, an activator labelled **"Kathryn drank coffee"**.
3. Activating it plays a short full-screen animation reading
   **"Verification failed, Kathryn doesn't drink coffee"** — the joke being that
   the claim is rejected.

## Requirements

- **It is a `<button>`, not an `<a>`.** It performs an action and navigates
  nowhere. Style it to look like a link if that reads better, but an anchor with
  no `href` is not keyboard operable and an `href="#"` would be a lie. This is
  the sort of thing that quietly breaks screen-reader and keyboard use.
- Reuse the existing `WinAnimation` conventions: full-screen layer, pointer
  events off so it never traps input, tap or key anywhere to dismiss early, and
  a self-clearing timer. **~3 seconds** feels right for a one-line gag; the win
  celebration's 5s is too long to sit through repeatedly.
- Read as a *failed verification* rather than a celebration — the error palette,
  not the green/purple game colours. No flashing (see the photosensitivity note
  in Addendum 3; that constraint stands for every animation in this app).
- Fully disabled under `prefers-reduced-motion: reduce`: show the message
  statically for the same duration, with no motion.
- Announce the message politely to assistive tech, and make it repeatable —
  pressing the button twice must play it twice, so key any effect on a nonce
  rather than on the message text.
- The Rules screen must remain scrollable and usable while it plays.
