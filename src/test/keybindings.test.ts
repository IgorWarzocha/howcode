import { describe, expect, it } from 'vitest'
import {
  eventToAcceleratorCandidates,
  isRightAltKeyEvent,
  isRightAltShortcutEvent,
  type KeybindingKeyboardEventLike,
} from '../../shared/keybindings'

function keyEvent(input: Partial<KeybindingKeyboardEventLike>) {
  return {
    altKey: false,
    code: 'KeyE',
    ctrlKey: false,
    key: 'e',
    location: 0,
    metaKey: false,
    shiftKey: false,
    ...input,
  } satisfies KeybindingKeyboardEventLike
}

describe('keybindings', () => {
  it('keeps left Alt accelerator candidates available', () => {
    const event = keyEvent({ altKey: true })

    expect(eventToAcceleratorCandidates(event)).toContain('Alt+E')
    expect(isRightAltShortcutEvent(event, false)).toBe(false)
  })

  it('detects Right Alt and AltGraph without treating right Shift as Right Alt', () => {
    expect(isRightAltKeyEvent(keyEvent({ code: 'AltRight', key: 'Alt', location: 2 }))).toBe(true)
    expect(isRightAltKeyEvent(keyEvent({ key: 'AltGraph' }))).toBe(true)
    expect(isRightAltShortcutEvent(keyEvent({ altKey: true }), true)).toBe(true)
    expect(
      isRightAltShortcutEvent(
        keyEvent({ altKey: true, getModifierState: (keyArg) => keyArg === 'AltGraph' }),
        false,
      ),
    ).toBe(true)
    expect(isRightAltKeyEvent(keyEvent({ code: 'ShiftRight', key: 'Shift', location: 2 }))).toBe(
      false,
    )
  })
})
