/**
 * @vitest-environment jsdom
 *
 * The win celebration is decorative, but its contract is not: it must end
 * itself after five seconds, it must end early on a tap, and it must never sit
 * in front of the player's input.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import {
  WinAnimation,
  WIN_ANIMATION_MS,
  WIN_ANIMATION_VARIANTS,
  randomWinVariant,
} from './WinAnimation'
import { strings } from './strings'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('randomWinVariant', () => {
  it('can produce every one of the five', () => {
    const seen = WIN_ANIMATION_VARIANTS.map((_unused, i) =>
      randomWinVariant(() => i / WIN_ANIMATION_VARIANTS.length),
    )
    expect(seen).toEqual(WIN_ANIMATION_VARIANTS)
  })

  it('stays in range at the top of the rng interval', () => {
    // Math.random() is [0,1), but a caller could hand us 1 by mistake.
    expect(WIN_ANIMATION_VARIANTS).toContain(randomWinVariant(() => 1))
    expect(WIN_ANIMATION_VARIANTS).toContain(randomWinVariant(() => 0))
  })
})

describe('WinAnimation', () => {
  it('finishes on its own after five seconds, once', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<WinAnimation variant="confetti" onDone={onDone} rowIndex={2} />)

    act(() => {
      vi.advanceTimersByTime(WIN_ANIMATION_MS - 1)
    })
    expect(onDone).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(onDone).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(WIN_ANIMATION_MS)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('is dismissed early by a tap anywhere, and only fires once', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<WinAnimation variant="nerdiest" onDone={onDone} />)

    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
      window.dispatchEvent(new Event('pointerdown'))
    })
    expect(onDone).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(WIN_ANIMATION_MS)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('does not swallow the tap that dismissed it', () => {
    const onDone = vi.fn()
    render(<WinAnimation variant="jump" onDone={onDone} />)
    const event = new Event('pointerdown', { cancelable: true, bubbles: true })
    window.dispatchEvent(event)
    // The menu button underneath still gets its click.
    expect(event.defaultPrevented).toBe(false)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('is hidden from assistive tech — the result is announced by the board', () => {
    const { container } = render(<WinAnimation variant="flames" onDone={vi.fn()} />)
    const root = container.querySelector('.nd-win')
    expect(root?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows the standard wordmark off an iPhone', () => {
    const { container } = render(
      <WinAnimation variant="nerdiest" onDone={vi.fn()} isIPhone={false} />,
    )
    expect(container.querySelector('.nd-win__word')?.textContent).toBe(strings.winWordmark)
  })

  it('shows the iPhone wordmark on an iPhone', () => {
    const { container } = render(
      <WinAnimation variant="nerdiest" onDone={vi.fn()} isIPhone={true} />,
    )
    expect(container.querySelector('.nd-win__word')?.textContent).toBe(
      strings.winWordmarkIPhone,
    )
    expect(strings.winWordmarkIPhone).toBe('Kathryn won, without drinking coffee!')
  })

  it('keeps the other four variants on the standard wordmark, iPhone or not', () => {
    // Every variant renders the wordmark — CSS shows it for the other four
    // under prefers-reduced-motion — so the joke has to be gated on `nerdiest`
    // here, not left to the stylesheet.
    for (const variant of WIN_ANIMATION_VARIANTS.filter((v) => v !== 'nerdiest')) {
      const { container, unmount } = render(
        <WinAnimation variant={variant} onDone={vi.fn()} isIPhone={true} />,
      )
      expect(container.querySelector('.nd-win__word')?.textContent, variant).toBe(
        strings.winWordmark,
      )
      unmount()
    }
  })

  it('defaults the platform check to the running environment, which is not an iPhone', () => {
    // jsdom's user agent says "jsdom", so the default path must fall through to
    // the standard wording without any override.
    const { container } = render(<WinAnimation variant="nerdiest" onDone={vi.fn()} />)
    expect(container.querySelector('.nd-win__word')?.textContent).toBe(strings.winWordmark)
  })

  it('parks its effect layer over the winning row', () => {
    const { container } = render(<WinAnimation variant="flames" onDone={vi.fn()} rowIndex={3} />)
    const root = container.querySelector('.nd-win')
    expect(root?.getAttribute('style')).toContain('--nd-win-row: 3')
  })
})
