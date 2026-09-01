/**
 * @vitest-environment jsdom
 *
 * Regression cover for the physical-keyboard path, added by the senior developer
 * after the Enter key was found dead in a real browser.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Keypad } from './Keypad'

const setup = (over: Partial<React.ComponentProps<typeof Keypad>> = {}) => {
  const props = {
    keyStates: {},
    onKeyPress: vi.fn(),
    onDelete: vi.fn(),
    onSubmit: vi.fn(),
    canSubmit: true,
    canDelete: true,
    ...over,
  }
  render(<Keypad {...props} />)
  return props
}

const press = (key: string) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('Keypad physical keyboard', () => {
  it('submits on Enter', () => {
    const { onSubmit } = setup()
    press('Enter')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('still submits on Enter after a keypad button has been tapped', () => {
    // THE REGRESSION. Tapping any key leaves that button focused. The handler
    // used to bail out whenever *any* button held focus, so from the first tap
    // onward Enter silently stopped submitting — and the browser re-clicked the
    // focused digit instead. Only the Enter button itself may be deferred to.
    const { onSubmit, onKeyPress } = setup()

    const seven = screen.getByRole('button', { name: /^7,/ })
    seven.focus()
    expect(document.activeElement).toBe(seven)

    press('Enter')

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onKeyPress).not.toHaveBeenCalled()
    cleanup()
  })

  it('defers to the browser when the Enter button itself has focus, so it fires once', () => {
    const { onSubmit } = setup()
    screen.getByRole('button', { name: /^Enter/ }).focus()
    press('Enter')
    // The browser turns this into a click on that button; handling it here too
    // would submit twice.
    expect(onSubmit).not.toHaveBeenCalled()
    cleanup()
  })

  it('does not submit when the row is incomplete', () => {
    const { onSubmit } = setup({ canSubmit: false })
    press('Enter')
    expect(onSubmit).not.toHaveBeenCalled()
    cleanup()
  })

  it('types digits and operators, and maps x to *', () => {
    const { onKeyPress } = setup()
    press('7'); press('+'); press('x')
    expect(onKeyPress).toHaveBeenNthCalledWith(1, '7')
    expect(onKeyPress).toHaveBeenNthCalledWith(2, '+')
    expect(onKeyPress).toHaveBeenNthCalledWith(3, '*')
    cleanup()
  })

  it('deletes on Backspace', () => {
    const { onDelete } = setup()
    press('Backspace')
    expect(onDelete).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('ignores modifier chords so browser shortcuts keep working', () => {
    const { onKeyPress } = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true }))
    expect(onKeyPress).not.toHaveBeenCalled()
    cleanup()
  })
})
