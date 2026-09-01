# Nerdier — Shared Contract (owned by senior-developer)

Package root: `com.nerdier.game`
minSdk 24 · targetSdk 37 · compileSdk 37 · Kotlin 2.4 · AGP 9.3 · Gradle 9.7 · Material 3

> AGP 9 supplies Kotlin itself — do NOT apply `org.jetbrains.kotlin.android`.

## File ownership — DISJOINT. Do not write outside your column.

| math-wizard | coder | game-designer | senior-developer |
|---|---|---|---|
| `math/EquationEngine.kt` | `logic/Scorer.kt` | `ui/theme/*.kt` | `model/*.kt` (this contract) |
| `math/Evaluator.kt` | `logic/GameEngine.kt` | `ui/screens/*.kt` | `MainActivity.kt` |
| `math/Generator.kt` | `logic/GameViewModel.kt` | `ui/components/*.kt` | all Gradle files |
| | `data/StatsRepository.kt` | `res/values/*.xml` | `NerdierApp.kt` (nav host) |
| | `data/StatsModels.kt` | | `src/test/**` |

Shared types below live in `model/` and are written ONCE, by the senior
developer. Everyone codes against them. Nobody edits them without asking.

## Shared types (already written — read them, do not redefine)

```kotlin
const val EQUATION_LENGTH = 8
const val MAX_GUESSES = 6

enum class TileState { EMPTY, FILLED, CORRECT, PRESENT, ABSENT }

data class Tile(val char: Char?, val state: TileState)

sealed interface GuessResult {
    data class Valid(val tiles: List<Tile>, val won: Boolean) : GuessResult
    data class Invalid(val reason: String) : GuessResult
}

sealed interface ValidationResult {
    data object Valid : ValidationResult
    data class Invalid(val reason: String) : ValidationResult
}
```

## Interfaces you must implement against

**math-wizard provides** (object `EquationEngine`):
- `fun generate(random: Random = Random): String` — a valid 8-char equation
- `fun validate(guess: String): ValidationResult` — specific human-readable reason on failure
- `fun evaluate(expression: String): Long?` — LHS value, or null if unevaluable
- `fun isCommutativelyEquivalent(a: String, b: String): Boolean`

**coder provides**:
- `object Scorer { fun score(guess: String, target: String): List<Tile> }`
- `class GameViewModel : ViewModel()` exposing `StateFlow<GameUiState>` and
  `onKeyPress(Char)`, `onDelete()`, `onSubmit()`, `onNewGame()`
- `GameUiState` — board rows, keypad states, error message, game status,
  target (revealed only on loss)
- `StatsRepository` with `today() / thisWeek() / thisMonth()` rollups

**game-designer consumes** both. Designer never mutates game state; it
receives `GameUiState` and emits events upward.

## Non-negotiable rules
1. 8 chars, exactly one `=`, operators LHS-only, RHS is 1–3 digits.
2. Integer math only, exact division, no negatives incl. intermediates,
   no leading zeros, standard operator precedence.
3. Scoring is TWO-PASS with character-count budgeting (Wordle rule),
   applied to digits, operators, and `=` alike.
4. An invalid guess does NOT consume a row.
5. A win may be commutative — do NOT infer "won" from "all tiles green".
6. No new third-party dependencies without senior-developer approval.
