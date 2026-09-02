/**
 * @vitest-environment jsdom
 *
 * The Kathryn easter egg is a joke, but its contract is the same as every
 * other animation here: it ends itself, it ends early on a tap, it never sits
 * in front of the player's input, and it plays again every time it is asked to.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import {
  KathrynEasterEgg,
  VerificationFailedAnimation,
  KATHRYN_ANIMATION_MS,
} from './KathrynEasterEgg'
import { RulesScreen } from './RulesScreen'
import { strings } from './strings'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** The layer is `aria-hidden`, so it is found by class rather than by role. */
function layer(): Element | null {
  return document.querySelector('.nd-kegg')
}

/** Arms the dismiss listeners, which sit behind a zero-delay timer. */
function arm(): void {
  act(() => {
    vi.advanceTimersByTime(0)
  })
}

describe('the Kathryn bullet and activator, in How to Play', () => {
  it('puts the bullet and the button in the Winning section', () => {
    render(<RulesScreen onBack={vi.fn()} />)

    const winning = screen.getByRole('heading', { name: strings.rulesHWinning })
    const list = winning.nextElementSibling
    expect(list?.tagName).toBe('UL')

    const bullet = screen.getByText(strings.rulesWinningKathryn)
    expect(list?.contains(bullet)).toBe(true)

    const button = screen.getByRole('button', { name: strings.rulesKathrynActivator })
    expect(list?.contains(button)).toBe(true)
    // Immediately after the bullet, and after every other Winning bullet.
    expect(bullet.nextElementSibling?.contains(button)).toBe(true)
  })

  it('is a button, not a link — it acts, it does not navigate', () => {
    render(<RulesScreen onBack={vi.fn()} />)
    const button = screen.getByRole('button', { name: strings.rulesKathrynActivator })
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
    expect(document.querySelector('a')).toBe(null)
  })

  it('says exactly what the principal asked for', () => {
    expect(strings.rulesKathrynFailure).toBe("Verification failed, Kathryn doesn't drink coffee")
    expect(strings.rulesKathrynActivator).toBe('Kathryn drank coffee')
  })
})

describe('KathrynEasterEgg', () => {
  it('shows nothing until it is activated', () => {
    render(<KathrynEasterEgg />)
    expect(layer()).toBe(null)
    expect(screen.queryByText(strings.rulesKathrynFailure)).toBe(null)
  })

  it('plays the failed verification when the button is pressed', () => {
    render(<KathrynEasterEgg />)
    fireEvent.click(screen.getByRole('button', { name: strings.rulesKathrynActivator }))

    // Once on the visible card, once in the live region.
    expect(screen.getAllByText(strings.rulesKathrynFailure)).toHaveLength(2)
    expect(layer()).not.toBe(null)
  })

  it('clears itself after three seconds', () => {
    vi.useFakeTimers()
    render(<KathrynEasterEgg />)
    fireEvent.click(screen.getByRole('button', { name: strings.rulesKathrynActivator }))
    arm()

    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS - 1)
    })
    expect(layer()).not.toBe(null)

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(layer()).toBe(null)
    expect(screen.queryByText(strings.rulesKathrynFailure)).toBe(null)
  })

  it('plays twice when pressed twice in a row, on a fresh nonce each time', () => {
    vi.useFakeTimers()
    render(<KathrynEasterEgg />)
    const button = screen.getByRole('button', { name: strings.rulesKathrynActivator })

    fireEvent.click(button)
    arm()
    const first = document.querySelector('.nd-kegg__word')
    expect(first).not.toBe(null)

    // Let it finish, then press again.
    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS)
    })
    expect(layer()).toBe(null)

    fireEvent.click(button)
    arm()
    const second = document.querySelector('.nd-kegg__word')
    expect(second).not.toBe(null)
    // A new node, not the first one left over: the CSS restarts from zero.
    expect(second).not.toBe(first)

    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS)
    })
    expect(layer()).toBe(null)
  })

  it('restarts mid-flight if it is pressed again while playing', () => {
    vi.useFakeTimers()
    render(<KathrynEasterEgg />)
    const button = screen.getByRole('button', { name: strings.rulesKathrynActivator })

    fireEvent.click(button)
    arm()
    const first = document.querySelector('.nd-kegg__word')

    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS - 500)
    })
    fireEvent.click(button)
    arm()
    const second = document.querySelector('.nd-kegg__word')
    expect(second).not.toBe(first)

    // The original timer would have fired by now; the restart owns the clock.
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(layer()).not.toBe(null)

    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS)
    })
    expect(layer()).toBe(null)
  })

  it('is not dismissed by the press that started it', () => {
    vi.useFakeTimers()
    render(<KathrynEasterEgg />)
    const button = screen.getByRole('button', { name: strings.rulesKathrynActivator })

    // What a real keyboard activation looks like: keydown, then click, both
    // reaching window.
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.click(button)
    expect(layer()).not.toBe(null)

    arm()
    expect(layer()).not.toBe(null)
  })

  it('announces politely, and only while it is playing', () => {
    render(<KathrynEasterEgg />)
    const live = screen.getByRole('status')
    // Mounted up front and empty: a live region that appears already populated
    // is announced unreliably.
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toBe('')

    fireEvent.click(screen.getByRole('button', { name: strings.rulesKathrynActivator }))
    expect(live.textContent).toBe(strings.rulesKathrynFailure)
  })

  it('hides the decorative layer from assistive tech', () => {
    render(<KathrynEasterEgg />)
    fireEvent.click(screen.getByRole('button', { name: strings.rulesKathrynActivator }))
    expect(layer()?.getAttribute('aria-hidden')).toBe('true')
  })

  it('leaves the rest of the Rules screen usable while it plays', () => {
    vi.useFakeTimers()
    const onBack = vi.fn()
    render(<RulesScreen onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: strings.rulesKathrynActivator }))
    arm()
    expect(layer()).not.toBe(null)

    // The scrolling content and the Back button are still there, and Back still
    // fires. The layer sits above them but takes no pointer input.
    expect(document.querySelector('.nd-subscreen__content')).not.toBe(null)
    expect(screen.getByText(strings.rulesIntro)).not.toBe(null)
    fireEvent.click(screen.getByRole('button', { name: strings.actionBack }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('VerificationFailedAnimation', () => {
  it('finishes on its own, once', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<VerificationFailedAnimation message="nope" nonce={1} onDone={onDone} />)
    arm()

    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS - 1)
    })
    expect(onDone).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(onDone).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('is dismissed early by a tap anywhere, and only fires once', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<VerificationFailedAnimation message="nope" nonce={1} onDone={onDone} />)
    arm()

    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
      window.dispatchEvent(new Event('pointerdown'))
    })
    expect(onDone).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('is dismissed early by a keypress anywhere', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<VerificationFailedAnimation message="nope" nonce={1} onDone={onDone} />)
    arm()

    act(() => {
      window.dispatchEvent(new Event('keydown'))
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('does not swallow the tap that dismissed it', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<VerificationFailedAnimation message="nope" nonce={1} onDone={onDone} />)
    arm()

    const event = new Event('pointerdown', { cancelable: true, bubbles: true })
    act(() => {
      window.dispatchEvent(event)
    })
    // Whatever was underneath still gets its click.
    expect(event.defaultPrevented).toBe(false)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('honours an overridden duration', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(
      <VerificationFailedAnimation message="nope" nonce={1} onDone={onDone} durationMs={800} />,
    )
    arm()

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('does not restart when only the callback identity changes', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const { rerender } = render(
      <VerificationFailedAnimation message="nope" nonce={1} onDone={() => onDone()} />,
    )
    arm()

    act(() => {
      vi.advanceTimersByTime(KATHRYN_ANIMATION_MS - 100)
    })
    rerender(<VerificationFailedAnimation message="nope" nonce={1} onDone={() => onDone()} />)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
