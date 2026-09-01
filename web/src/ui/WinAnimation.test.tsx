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

  it('parks its effect layer over the winning row', () => {
    const { container } = render(<WinAnimation variant="flames" onDone={vi.fn()} rowIndex={3} />)
    const root = container.querySelector('.nd-win')
    expect(root?.getAttribute('style')).toContain('--nd-win-row: 3')
  })
})
