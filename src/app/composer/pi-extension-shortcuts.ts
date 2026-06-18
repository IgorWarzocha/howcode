import { isRightAltShortcutEvent } from '@howcode/shared/keybindings'

export { isRightAltKeyEvent } from '@howcode/shared/keybindings'

export type PiExtensionShortcutKeyboardEventLike = Pick<
  KeyboardEvent,
  'altKey' | 'code' | 'ctrlKey' | 'isComposing' | 'key' | 'location' | 'metaKey' | 'shiftKey'
> & {
  getModifierState?: (keyArg: 'AltGraph') => boolean
}

export function getPiExtensionShortcutKey(event: PiExtensionShortcutKeyboardEventLike) {
  if (event.isComposing) return null
  const key = getPiExtensionShortcutBaseKey(event)
  if (!key) return null
  const modifiers = [
    event.ctrlKey ? 'ctrl' : null,
    event.altKey ? 'alt' : null,
    event.shiftKey ? 'shift' : null,
    event.metaKey ? 'meta' : null,
  ].filter(Boolean)
  return [...modifiers, key].join('+')
}

export function isPlainPiExtensionShortcut(shortcut: string) {
  return !shortcut.includes('+')
}

export function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function isRightAltPiExtensionShortcutEvent(
  event: PiExtensionShortcutKeyboardEventLike,
  rightAltPressed: boolean,
) {
  return isRightAltShortcutEvent(event, rightAltPressed)
}

function getPiExtensionShortcutBaseKey(event: Pick<KeyboardEvent, 'code' | 'key'>) {
  if (event.code.startsWith('Key')) return event.code.slice(3).toLowerCase()
  if (event.code.startsWith('Digit')) return event.code.slice(5)
  if (event.code === 'ArrowLeft') return 'left'
  if (event.code === 'ArrowRight') return 'right'
  if (event.code === 'ArrowUp') return 'up'
  if (event.code === 'ArrowDown') return 'down'
  if (event.code === 'Escape') return 'escape'
  if (event.code === 'Enter') return 'enter'
  if (event.code === 'Space') return 'space'
  if (event.key.length === 1) return event.key.toLowerCase()
  return event.key.toLowerCase() || null
}
