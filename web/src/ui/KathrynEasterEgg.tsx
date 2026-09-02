import { useCallback, useEffect, useRef, useState } from 'react'
import { strings } from './strings'
import './KathrynEasterEgg.css'

/**
 * The Kathryn easter egg, in How to Play's *Winning* section.
 *
 * A bullet claims that if Kathryn starts drinking coffee she wins the game; the
 * activator underneath it asserts that she has. The app disagrees, briefly and
 * full-screen: "Verification failed, Kathryn doesn't drink coffee".
 *
 * Conventions are {@link WinAnimation}'s, deliberately:
 *   - a full-screen layer that is `pointer-events: none` throughout, so the
 *     Rules screen keeps scrolling and Back keeps working while it plays;
 *   - a self-clearing timer, and a tap or keypress anywhere ends it early;
 *   - the visible layer is `aria-hidden`, and a separate, permanently mounted
 *     polite live region carries the words to assistive tech.
 *
 * Unlike the win celebration this is an *error*: it draws from the error
 * palette, never the green/purple game colours, and it runs for three seconds
 * rather than five because it is one line and people will press it repeatedly.
 *
 * Replays are driven by a nonce, exactly as `errorId` drives the row shake:
 * the message text never changes, so nothing keyed on the text would notice a
 * second press. The nonce is in the effect's dependencies (restarting the
 * timer) and on the animated nodes' `key` (restarting the CSS) and on the live
 * region's child (re-announcing).
 */

/** Three seconds — the same whether or not motion is allowed. */
export const KATHRYN_ANIMATION_MS = 3000

export interface VerificationFailedAnimationProps {
  /** The words to show. Comes from `strings`; never assembled here. */
  readonly message: string
  /** Incremented by the parent on every activation. Restarts the run. */
  readonly nonce: number
  /** Fired when the three seconds are up, or on the first tap/keypress after. */
  readonly onDone: () => void
  /** Overrides the run time. Tests and previews use it; the egg does not. */
  readonly durationMs?: number | undefined
}

/**
 * The full-screen layer. Stateless: it is told what to say and when it started,
 * and it reports back once.
 */
export function VerificationFailedAnimation({
  message,
  nonce,
  onDone,
  durationMs,
}: VerificationFailedAnimationProps) {
  // In a ref so a fresh callback identity from the parent cannot restart the
  // three seconds halfway through.
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    let finished = false
    const finish = (): void => {
      if (finished) return
      finished = true
      doneRef.current()
    }

    const timer = window.setTimeout(finish, durationMs ?? KATHRYN_ANIMATION_MS)

    // The activation itself must not also dismiss. A <button> fires `click`
    // from inside the keydown (Enter) or keyup (Space) that is still on its way
    // up to window, and a mouse press has already dispatched `pointerdown`, so
    // listeners attached during that same turn could catch the very event that
    // started us. Arm on the next task instead.
    let armed = false
    const arming = window.setTimeout(() => {
      armed = true
    }, 0)
    const dismiss = (): void => {
      if (armed) finish()
    }

    // These never call preventDefault and never stop propagation: the tap that
    // dismisses the gag still does whatever it was going to do.
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', dismiss)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(arming)
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', dismiss)
    }
  }, [nonce, durationMs])

  return (
    // Decorative: the live region next door does the announcing, and a second
    // copy in the accessibility tree would just say it twice.
    <div className="nd-kegg" aria-hidden="true">
      {/* Keyed on the nonce so a repeat press restarts the CSS rather than
          leaving a finished animation on screen. */}
      <div key={`wash-${nonce}`} className="nd-kegg__wash" />
      <div key={`word-${nonce}`} className="nd-kegg__wordmark">
        <p className="nd-kegg__word">{message}</p>
      </div>
    </div>
  )
}

export interface KathrynEasterEggProps {
  /** Overrides the run time, for tests and previews. */
  readonly durationMs?: number | undefined
}

/**
 * Activator plus animation. The only state here is "is the gag on screen, and
 * which run is it" — nothing about the game, which lives in the game hook.
 *
 * It is a `<button>`, not an anchor: it performs an action and navigates
 * nowhere. It is styled to read as a link inside the bullet list, but a link
 * without a real destination is not keyboard operable and `href="#"` would be a
 * lie about where it goes.
 */
export function KathrynEasterEgg({ durationMs }: KathrynEasterEggProps) {
  const [nonce, setNonce] = useState(0)
  const [playing, setPlaying] = useState(false)

  const activate = useCallback(() => {
    setNonce((n) => n + 1)
    setPlaying(true)
  }, [])

  const handleDone = useCallback(() => {
    setPlaying(false)
  }, [])

  return (
    <>
      <button type="button" className="nd-rules__egg-button" onClick={activate}>
        {strings.rulesKathrynActivator}
      </button>

      {/* Mounted whether or not the gag is playing: a live region that arrives
          already populated is announced unreliably. The child is keyed on the
          nonce, so a second press inserts a new node into a region that is
          already being watched, and the message is read out again. */}
      <div className="nd-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {playing ? <span key={nonce}>{strings.rulesKathrynFailure}</span> : null}
      </div>

      {playing ? (
        <VerificationFailedAnimation
          message={strings.rulesKathrynFailure}
          nonce={nonce}
          onDone={handleDone}
          durationMs={durationMs}
        />
      ) : null}
    </>
  )
}
