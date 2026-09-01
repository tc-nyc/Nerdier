import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import './WinAnimation.css'

/**
 * The five win celebrations. One is drawn at random on a win, runs for five
 * seconds, and then removes itself, leaving the finished board exactly as it
 * was — there is no summary card and nothing lingers.
 *
 * `jump` and `spin` animate the winning row's own tiles, so those two are drawn
 * by CSS that {@link TileGrid} switches on with `data-nd-win` on the row; this
 * component still owns their timing. `flames` and `confetti` draw into an
 * absolutely positioned layer anchored over the winning row. `nerdiest` is a
 * full-screen wash.
 *
 * Nothing here is interactive: every layer is `pointer-events: none`, so the
 * menu, the keypad and Play Again all stay live underneath. A tap or a keypress
 * anywhere ends the celebration early.
 */
export type WinAnimationVariant = 'jump' | 'flames' | 'confetti' | 'spin' | 'nerdiest'

export const WIN_ANIMATION_VARIANTS: readonly WinAnimationVariant[] = [
  'jump',
  'flames',
  'confetti',
  'spin',
  'nerdiest',
]

/** The principal's brief: five seconds, then back to the board. */
export const WIN_ANIMATION_MS = 5000

/**
 * With `prefers-reduced-motion: reduce` there is nothing to watch — just the
 * words, held long enough to read and no longer.
 */
export const WIN_ANIMATION_REDUCED_MS = 1800

/** Picks one of the five. `rng` is injectable so previews and tests can pin it. */
export function randomWinVariant(rng: () => number = Math.random): WinAnimationVariant {
  const last = WIN_ANIMATION_VARIANTS.length - 1
  const index = Math.min(Math.max(Math.floor(rng() * WIN_ANIMATION_VARIANTS.length), 0), last)
  return WIN_ANIMATION_VARIANTS[index] ?? 'jump'
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Deterministic 0..1 from an integer, so the confetti scatter is stable across renders. */
function noise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const FLAME_COUNT = 11
const EMBER_COUNT = 9
const CONFETTI_COUNT = 24

interface ConfettiPiece {
  readonly left: number
  readonly drift: number
  readonly delay: number
  readonly duration: number
  readonly spin: number
  readonly size: number
  readonly colour: number
}

/** Built once at module load: the scatter never needs to change. */
const CONFETTI: readonly ConfettiPiece[] = Array.from(
  { length: CONFETTI_COUNT },
  (_unused, i): ConfettiPiece => ({
    left: 4 + noise(i) * 92,
    drift: (noise(i + 100) - 0.5) * 130,
    delay: noise(i + 200) * 900,
    duration: 1700 + noise(i + 300) * 1500,
    spin: 360 + Math.round(noise(i + 400) * 900),
    size: 5 + Math.round(noise(i + 500) * 5),
    colour: (i % 5) + 1,
  }),
)

export interface WinAnimationProps {
  readonly variant: WinAnimationVariant
  /** Fired when the five seconds are up, or when the player taps to skip. */
  readonly onDone: () => void
  /** Which board row won, 0-based. The effect layer is parked over it. */
  readonly rowIndex?: number
  /** Overrides the run time. Previews use it; the game does not. */
  readonly durationMs?: number
}

export function WinAnimation({ variant, onDone, rowIndex = 0, durationMs }: WinAnimationProps) {
  // Held in a ref so a fresh callback identity from the parent cannot restart
  // the five seconds halfway through.
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const reduced = prefersReducedMotion()
    const ms = durationMs ?? (reduced ? WIN_ANIMATION_REDUCED_MS : WIN_ANIMATION_MS)

    let finished = false
    const finish = (): void => {
      if (finished) return
      finished = true
      doneRef.current()
    }

    const timer = window.setTimeout(finish, ms)
    // Skip on any interaction. These listeners never call preventDefault and
    // never stop propagation, so the tap that dismisses the celebration also
    // does whatever it was going to do — opening the menu, say.
    window.addEventListener('pointerdown', finish)
    window.addEventListener('keydown', finish)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', finish)
      window.removeEventListener('keydown', finish)
    }
  }, [variant, rowIndex, durationMs])

  const style = { '--nd-win-row': String(rowIndex) } as CSSProperties

  return (
    // Decorative only. The result is already announced by the board's own live
    // region, and a second announcement would just talk over it.
    <div className={`nd-win nd-win--${variant}`} style={style} aria-hidden="true">
      {variant === 'flames' ? (
        <div className="nd-win__layer nd-win__flames">
          {Array.from({ length: FLAME_COUNT }, (_unused, i) => (
            <span
              key={`f${i}`}
              className="nd-win__flame"
              style={
                {
                  '--nd-i': String(i),
                  left: `${((i + 0.5) / FLAME_COUNT) * 100}%`,
                } as CSSProperties
              }
            />
          ))}
          {Array.from({ length: EMBER_COUNT }, (_unused, i) => (
            <span
              key={`e${i}`}
              className="nd-win__ember"
              style={
                {
                  '--nd-i': String(i),
                  '--nd-drift': `${(noise(i + 700) - 0.5) * 40}px`,
                  left: `${6 + noise(i + 600) * 88}%`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      {variant === 'confetti' ? (
        <div className="nd-win__layer nd-win__confetti">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className={`nd-win__piece nd-win__piece--${p.colour}`}
              style={
                {
                  '--nd-drift': `${p.drift}px`,
                  '--nd-spin': `${p.spin}deg`,
                  left: `${p.left}%`,
                  width: `${p.size}px`,
                  height: `${p.size * 1.6}px`,
                  animationDelay: `${p.delay}ms`,
                  animationDuration: `${p.duration}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      {variant === 'nerdiest' ? <div className="nd-win__flash" /> : null}

      {/* Shown for `nerdiest`, and — via CSS alone — for all five once the
          player has asked for reduced motion. */}
      <div className="nd-win__wordmark">
        <span className="nd-win__word">You are the Nerdiest</span>
      </div>
    </div>
  )
}
