# Nerdier — Testing

```bash
cd web
npm test          # 184 tests
npx tsc --noEmit  # strict type-check
```

**Current result: 184 tests, 0 failures.** The GitHub Actions workflow runs both
before deploying, so a red build never reaches Azure.

| Suite | Tests | Covers |
|---|---|---|
| `game/engine.test.ts` | 32 | Cursor, gaps, row consumption, win/loss, commutative wins |
| `game/equation.test.ts` | 26 | Validation rules, evaluation, commutativity, generator fuzzing |
| `game/stats.test.ts` | 34 | Day/week/month buckets, streaks, distribution, average guesses, per-game series |
| `game/useGame.test.tsx` | 18 | The React seam: cursor, error identity, target concealment, stats writes |
| `game/scorer.test.ts` | 12 | Tile colouring, duplicate-character budgeting, keypad monotonicity |
| `ui/Keypad.test.tsx` | 7 | Physical keyboard, including the Enter regression below |
| `ui/WinAnimation.test.tsx` | 7 | Variant selection, duration, reduced-motion, non-blocking input |
| `ui/TileGrid.test.tsx` | 6 | Tile clicks, caret rendering, gap rendering |
| `ui/Keypad.arrows.test.tsx` | 5 | Arrow-key cursor movement |
| `ui/GameTrendChart.test.tsx` | 25 | Month line chart: empty, single point, many games, loss markers |
| `ui/ProgressScreen.test.tsx` | 9 | Stat cells, average formatting, em-dash empty state |
| `ui/GameScreen.test.tsx` | 3 | Screen wiring |

## The six things most likely to be wrong

### 1. Duplicate characters in scoring

Scoring is two-pass with a per-character budget taken from the target. A
one-pass `target.includes(c)` test gets duplicates wrong in both directions.

Anchor case — target `12+34=46`, guess `44+11=55`:

```
guess    4  4  +  1  1  =  5  5
result   P  P  G  P  -  G  -  -
```

The target holds **two** 4s, so both guessed 4s are PRESENT. It holds only
**one** 1, so the first guessed 1 is PRESENT and the second is ABSENT. That
second 1 is the tell.

### 2. A commutative win that does not look like a win

If the answer is `12+34=46`, then `34+12=46` wins — but it scores
`P P G P P G G G`, which is **not all green**. Any implementation that infers
"won" from "every tile is correct" reports a loss on a winning guess.

`engine.ts` computes `won` from the arithmetic layer and never inspects tile
colours. The test asserts both that it is a win *and* that the tiles are
deliberately not all green, so the test still fails if someone "simplifies" it.

### 3. Invalid guesses stealing a row

A rejected equation must not cost one of the six guesses. Covered in
`engine.test.ts` and again through the hook in `useGame.test.tsx`, which also
asserts the validator's message reaches the UI verbatim.

### 4. Generator / validator drift

If the generator can emit something the validator rejects, the game becomes
unwinnable. `equation.test.ts` generates **20,000 equations and feeds every one
back through the validator**. The design makes drift structurally hard too: the
generator's final accept test *is* `validateEquation`.

### 5. The physical keyboard (found in a real browser, not by a test)

The Enter key was dead in the browser while every unit test passed. The handler
skipped Enter whenever *any* button held focus — reasoning that the browser
already turns Enter into a click on a focused button. But tapping any keypad
digit leaves that digit focused, so from the first tap onward Enter silently
stopped submitting, and the browser re-clicked the digit instead.

The fix defers only when the **Enter button itself** has focus.
`Keypad.test.tsx` covers it, and the test was confirmed to fail against the old
code before being accepted.

The lesson worth keeping: this bug was invisible to jsdom-style checks that
dispatch events at a clean document. It needed a real browser and a realistic
interaction order.

### 6. Building a guess from a row with gaps

Since the principal chose crossword-style entry, the active row may hold holes.
`rowText()` skips them, so a row showing `1_+34=46` would compact to the
seven-character `1+34=46` — a guess the player never typed.

`rowEquation()` is now the only legal source for a guess: it returns `null`
unless all eight positions are filled. `currentText()` was deleted from the
engine outright so the old concatenating path cannot be reached by accident. A
test asserts, as a precondition, that `rowText` *does* compact `1_+34=46` — so
it fails loudly if anyone reintroduces the gap-skipping submit path.

## Verification beyond the test suite

The TypeScript equation engine was cross-checked against an **independent Python
enumeration of the entire legal equation space**:

- **65,374** eight-character equations satisfy all eight rules.
- The TypeScript validator accepts **exactly** those — 0 false rejections.
- **0 disagreements** across 300,000 random 8-character strings.
- **0** of 20,000 generated puzzles fell outside the legal set.

This matters because it checks the port against a specification, not against
itself. The original Kotlin under `android/` remains as a second reference.

## Verified by hand in a browser

A solver was driven through the real UI: it imported the app's own equation and
scorer modules, built a pool of 31,435 candidate equations, then played guesses
and filtered by the tile colours the page actually rendered. **It solved the
puzzle in 3 guesses, the pool narrowing 31,435 → 65 → 1.** That the pool never
emptied means the live game's scoring agrees exactly with the scorer on every
surviving candidate — an end-to-end consistency check no unit test provides.

The same run caught the commutative win in production: guessing `8*5-36=4`
against the target `5*8-36=4` scored `P G P G G G G G` — **not all green** — and
the game still announced "Solved in 3 of 6 guesses."

Also driven live at a 375×812 mobile viewport:

- Board renders 6 × 8 with the keypad fully visible, no horizontal scroll.
- `51+21=42` → red banner reading *"51+21=42 — the left side equals 72"*, the row
  shakes and is **not** consumed.
- A valid guess scores and reveals correctly, `=` landing green in position 6.
- Enter, Backspace, digits and operators all work from the physical keyboard.
- Progress screen shows Today / This Week / This Month with a proper empty state.
- Rules screen renders, including the subtraction-order clarification.
- Light and dark themes both render legibly.
- Clicking tile 6 of an empty row and typing produces `_____7__` — a genuine gap
  — with Enter correctly disabled until all eight are filled.
- The caret renders as a cyan border plus a bottom bar, distinct from the
  green/purple/black scoring colours, in both themes.
- Win animations inspected frame-by-frame in a temporary harness (since removed):
  **flames** paint gold/orange licks over the winning row, **confetti** scatters
  coloured pieces, **jump** lifts and scales the row, and **nerdiest** renders
  "You are the Nerdiest" over a soft grey wash.
- Untried keypad keys (`0`-`9`, `+ - * / =`) render white in both themes, with
  eliminated keys going black and present keys purple alongside them — verified
  side by side after a real submit. ENTER and DELETE are unchanged.
- Unused board tiles render white in both themes; typed tiles revert to the page
  colour, so the active row reads dark-on-white in dark mode. Contrast measured
  live: empty-tile border 10.7:1 against its white fill in dark, filled-tile
  glyph 14.9:1.
- Progress screen shows Played / Avg guesses / Win rate / Streak, with This
  Month rendering the line chart (1 at top, green dots solved, hollow rings for
  losses) and Today / This Week keeping their bar histograms. Seeded 12 games
  (10 wins) and the displayed 3.6 average matched an independent calculation.
- The flash rate of the `nerdiest` variant was measured in the browser at
  **0.8s per cycle = 1.25 flashes/second**, against the WCAG 2.3.1 limit of 3,
  with a 28%-alpha slate wash rather than black — see below.

## Not covered

- No end-to-end browser test suite (Playwright or similar). Browser verification
  above was manual.
- The service worker's offline behaviour has not been exercised — the PWA builds
  and precaches 11 entries, but no one has loaded it with the network off.
- `storage.ts` is tested against fakes and a throwing backend, not against real
  Safari private mode.
- No visual regression testing; appearance is checked by eye.
- The `spin` variant was not inspected visually; it is covered by unit tests and
  by the shared animation plumbing only.
- Reduced-motion behaviour is unit tested but was not viewed in a browser.

## Photosensitivity

The `nerdiest` win animation flashes the screen. Rapid full-screen luminance
change can trigger seizures in people with photosensitive epilepsy, so it is
deliberately capped at **1.25 flashes per second** — 2.4× inside the WCAG 2.3.1
general flash threshold of three per second — with a desaturated slate wash at
0.28 alpha and no saturated red. Measured in the browser, not merely asserted.

**Do not shorten that cycle or raise the alpha.** All five animations are
disabled entirely under `prefers-reduced-motion: reduce`, which shows a brief
static wordmark instead.
