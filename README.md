# Nerdier

A browser take on the daily-equation puzzle game **Nerdle**. You get six tries to
find a hidden eight-character arithmetic equation.

```
  1   2   +   3   4   =   4   6
```

After each guess every tile is coloured:

| Colour | Meaning |
|---|---|
| 🟩 **Green** | Right character, right position |
| 🟪 **Purple** | That character is in the equation, but somewhere else |
| ⬛ **Black** | That character is not in the equation |

The same colouring applies to the operators `+ − × ÷` and to `=`, not just the
digits.

## The rules Nerdier enforces

- Exactly **8 characters**, exactly **one `=`**.
- Operators appear **only on the left** of the `=`; the right side is a plain
  number of **1, 2, or 3 digits**.
- Standard **order of operations** — `*` and `/` bind before `+` and `-`.
- **Whole numbers only.** Division must come out exact, and nothing may go
  negative, not even part-way through.
- No leading zeros on multi-digit numbers.
- Submitting arithmetic that does not balance (say `51+21=42`) shows an error
  and **does not use up a guess** — you edit that row and resubmit.
- A **commutative** rearrangement still wins: if the answer is `5+3=8`, guessing
  `3+5=8` wins. This is strict — only `+` and `*` reorder, so `8-3=5` is not
  satisfied by `3-8=5`.

## Features

- 6 × 8 guess grid with an on-screen keypad **and** full physical-keyboard
  support, tracking which characters you've eliminated.
- Hamburger menu → **New Game** and **How to Play**.
- Chart icon → **Progress**: games played, won, win %, streak and a guess
  distribution for **Today**, **This Week** and **This Month**.
- Light and dark themes, accessible labelling throughout.
- Unlimited puzzles from a runtime generator — every "New Game" is fresh.
- **Installable PWA**: add it to your home screen on iOS or Android and it works
  offline, with no app store and no sideloading.

## Tech

React 19 · TypeScript 5.9 (strict) · Vite 7 · Vitest 3 · no backend

Stats live in your browser's `localStorage`. There is no server, no account and
no tracking.

## Getting started

```bash
cd web
npm install
npm run dev
```

To host it, pick one:
- **[docs/DEPLOY_SYNOLOGY.md](docs/DEPLOY_SYNOLOGY.md)** — self-hosted on a
  Synology NAS via Web Station. Nothing exposed to the internet.
- **[docs/DEPLOY_AZURE.md](docs/DEPLOY_AZURE.md)** — Azure Static Web Apps, free
  tier, public URL with HTTPS and the PWA working out of the box.

## Project layout

```
Nerdle Clone/
├── web/                     the app
│   ├── src/game/            pure logic — no React
│   │   ├── types.ts         shared vocabulary        — senior developer
│   │   ├── equation.ts      generate / validate      — math wizard
│   │   ├── scorer.ts        tile colouring           — coder
│   │   ├── engine.ts        game state machine       — coder
│   │   ├── stats.ts         rollups                  — coder
│   │   └── storage.ts       localStorage             — coder
│   ├── src/ui/              React components         — game designer
│   └── src/App.tsx          wiring                   — senior developer
├── android/                 the original Android app (unmaintained)
└── docs/
```

### About `android/`

Nerdier started as a native Android app. It was retired because installing it
meant Android Studio, an APK and sideloading — too much friction for a browser
game. It's kept because it builds, passes 54 Kotlin tests, and serves as the
reference implementation the TypeScript was ported against. It is not maintained.

## How this was built

Four agents, defined in [`.claude/agents/`](.claude/agents/) and usable via
`/agents`:

| Agent | Owns |
|---|---|
| **math-wizard** | Generating valid equations, evaluating them, validating guesses, deciding commutative equivalence |
| **game-designer** | The UI: grid, keypad, drawer, rules and progress screens, theming, accessibility |
| **coder** | Two-pass tile scoring, win/loss detection, game state, stats storage |
| **senior-developer** | Coordination, scope control, file-ownership boundaries, code review, integration, tests, docs |

## Docs

- [docs/DEPLOY_SYNOLOGY.md](docs/DEPLOY_SYNOLOGY.md) — self-host on a Synology NAS
- [docs/DEPLOY_AZURE.md](docs/DEPLOY_AZURE.md) — publish it to the web, free
- [docs/WEB_CONTRACT.md](docs/WEB_CONTRACT.md) — interfaces and file ownership
- [docs/TESTING.md](docs/TESTING.md) — what is tested and why
- [docs/INSTALL.md](docs/INSTALL.md) — building the retired Android app
