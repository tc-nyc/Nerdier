/**
 * @vitest-environment jsdom
 *
 * The on-screen DELETE button, which no longer means the same thing as the
 * physical Backspace key. The button clears the tile the caret is sitting on
 * (falling back to a backspace when that tile is empty — a decision that lives
 * in the engine, not here); Backspace still deletes backwards, always.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Keypad } from './Keypad'

afterEach(cleanup)

const deleteButton = (): HTMLElement => screen.getByRole('button', { name: /^Delete/ })

describe('Keypad on-screen DELETE button', () => {
  it('calls onDeleteAtSelection, not the backspace handler', () => {
    const onDelete = vi.fn()
    const onDeleteAtCursor = vi.fn()
    const onDeleteAtSelection = vi.fn()
    render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={onDelete}
        onDeleteAtCursor={onDeleteAtCursor}
        onDeleteAtSelection={onDeleteAtSelection}
        onSubmit={vi.fn()}
      />,
    )

    fireEvent.click(deleteButton())

    expect(onDeleteAtSelection).toHaveBeenCalledTimes(1)
    expect(onDeleteAtCursor).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('falls back to onDeleteAtCursor, then to onDelete, when unwired', () => {
    const onDelete = vi.fn()
    const onDeleteAtCursor = vi.fn()
    const { unmount } = render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={onDelete}
        onDeleteAtCursor={onDeleteAtCursor}
        onSubmit={vi.fn()}
      />,
    )
    fireEvent.click(deleteButton())
    expect(onDeleteAtCursor).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
    unmount()

    render(
      <Keypad keyStates={{}} onKeyPress={vi.fn()} onDelete={onDelete} onSubmit={vi.fn()} />,
    )
    fireEvent.click(deleteButton())
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('leaves the physical Backspace key on the backspace handler', () => {
    const onDelete = vi.fn()
    const onDeleteAtSelection = vi.fn()
    render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={onDelete}
        onDeleteAtSelection={onDeleteAtSelection}
        onSubmit={vi.fn()}
      />,
    )

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDeleteAtSelection).not.toHaveBeenCalled()
  })

  it('names itself after what it now does', () => {
    render(<Keypad keyStates={{}} onKeyPress={vi.fn()} onDelete={vi.fn()} onSubmit={vi.fn()} />)
    // Not "delete last character": it clears the tile the player selected.
    expect(deleteButton().getAttribute('aria-label')).toBe('Delete, clears the selected tile')
  })

  it('takes its enabled state from canDeleteAtSelection when given', () => {
    const { unmount } = render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={vi.fn()}
        onDeleteAtSelection={vi.fn()}
        onSubmit={vi.fn()}
        canDelete={false}
        canDeleteAtSelection={true}
      />,
    )
    // canDelete is about the physical keys now; the button has its own flag,
    // and a button that would have worked must not look dead.
    expect(deleteButton()).toHaveProperty('disabled', false)
    unmount()

    render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={vi.fn()}
        onDeleteAtSelection={vi.fn()}
        onSubmit={vi.fn()}
        canDelete={true}
        canDeleteAtSelection={false}
      />,
    )
    expect(deleteButton()).toHaveProperty('disabled', true)
  })

  it('falls back to canDelete when the newer flag is absent', () => {
    render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={vi.fn()}
        onDeleteAtSelection={vi.fn()}
        onSubmit={vi.fn()}
        canDelete={false}
      />,
    )
    expect(deleteButton()).toHaveProperty('disabled', true)
  })

  it('stays dead when the whole pad is disabled', () => {
    const onDeleteAtSelection = vi.fn()
    render(
      <Keypad
        keyStates={{}}
        onKeyPress={vi.fn()}
        onDelete={vi.fn()}
        onDeleteAtSelection={onDeleteAtSelection}
        onSubmit={vi.fn()}
        canDeleteAtSelection={true}
        enabled={false}
      />,
    )
    expect(deleteButton()).toHaveProperty('disabled', true)
  })
})
