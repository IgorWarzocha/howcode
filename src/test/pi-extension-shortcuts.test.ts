import { describe, expect, it } from 'vitest'
import {
  getPiExtensionShortcutKey,
  isRightAltKeyEvent,
  isRightAltPiExtensionShortcutEvent,
  type PiExtensionShortcutKeyboardEventLike,
} from '../app/composer/pi-extension-shortcuts'

function keyEvent(input: Partial<PiExtensionShortcutKeyboardEventLike>) {
  return {
    altKey: false,
    code: 'KeyE',
    ctrlKey: false,
    isComposing: false,
    key: 'e',
    location: 0,
    metaKey: false,
    shiftKey: false,
    ...input,
  } satisfies PiExtensionShortcutKeyboardEventLike
}

describe('Pi extension shortcuts', () => {
  it('keeps left Alt shortcuts available', () => {
    const event = keyEvent({ altKey: true })

    expect(getPiExtensionShortcutKey(event)).toBe('alt+e')
    expect(isRightAltPiExtensionShortcutEvent(event, false)).toBe(false)
  })

  it('blocks shortcuts while Right Alt is held', () => {
    const rightAltDown = keyEvent({ code: 'AltRight', key: 'Alt', location: 2 })
    const textKey = keyEvent({ altKey: true, key: 'ę' })

    expect(isRightAltKeyEvent(rightAltDown)).toBe(true)
    expect(getPiExtensionShortcutKey(textKey)).toBe('alt+e')
    expect(isRightAltPiExtensionShortcutEvent(textKey, true)).toBe(true)
  })

  it('does not mistake other right-side modifiers for Right Alt', () => {
    const event = keyEvent({ code: 'ShiftRight', key: 'Shift', location: 2, shiftKey: true })

    expect(isRightAltKeyEvent(event)).toBe(false)
    expect(isRightAltPiExtensionShortcutEvent(event, false)).toBe(false)
  })

  it('treats AltGraph as Right Alt input, even without tracked state', () => {
    const event = keyEvent({
      altKey: true,
      getModifierState: (keyArg) => keyArg === 'AltGraph',
    })

    expect(isRightAltPiExtensionShortcutEvent(event, false)).toBe(true)
  })
})
