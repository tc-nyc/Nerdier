/**
 * @vitest-environment jsdom
 *
 * The caret half of the physical-keyboard path. Kept apart from Keypad.test.tsx
 * so the senior developer's Enter-key regression cover stays exactly as written.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Keypad } from './Keypad'

afterEach(cleanup)

const press = (key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('Keypad arrow keys and forward delete', () => {
  it('moves the caret left and right', () => {
    const onArrow = vi.fn()
    render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={vi.fn()}
        onSubmit={vi.fn()}
        onArrow={onArrow}
      />,
    )
    const left = press('ArrowLeft')
    const right = press('ArrowRight')
    expect(onArrow).toHaveBeenNthCalledWith(1, 'left')
    expect(onArrow).toHaveBeenNthCalledWith(2, 'right')
    // Swallowed, so the arrows drive the caret rather than scrolling the page.
    expect(left.defaultPrevented).toBe(true)
    expect(right.defaultPrevented).toBe(true)
  })

  it('leaves the arrows to the browser when no handler is wired', () => {
    render(
      <Keypad keyStates={{}} onKeyPress={vi.fn()} onDelete={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(press('ArrowLeft').defaultPrevented).toBe(false)
  })

  it('sends Delete to the forward-delete handler and Backspace to the other', () => {
    const onDelete = vi.fn()
    const onDeleteAtCursor = vi.fn()
    render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={onDelete}
        onDeleteAtCursor={onDeleteAtCursor}
        onSubmit={vi.fn()}
      />,
    )
    press('Delete')
    press('Backspace')
    expect(onDeleteAtCursor).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('falls back to Backspace behaviour when forward delete is not wired', () => {
    const onDelete = vi.fn()
    render(
      <Keypad keyStates={{}} onKeyPress={vi.fn()} onDelete={onDelete} onSubmit={vi.fn()} />,
    )
    press('Delete')
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('does not move the caret while the game is over', () => {
    const onArrow = vi.fn()
    render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={vi.fn()}
        onSubmit={vi.fn()}
        onArrow={onArrow}
        enabled={false}
      />,
    )
    press('ArrowLeft')
    expect(onArrow).not.toHaveBeenCalled()
  })
})
