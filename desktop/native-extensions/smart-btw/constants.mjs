export const WIDGET_ID = 'smart-btw'
export const MESSAGE_TYPE_PREFIX = 'BTW SESSION'
export const SHORTCUTS = {
  compose: 'ctrl+alt+z',
  inject: 'ctrl+alt+c',
  clear: 'ctrl+alt+x',
  fold: 'ctrl+alt+down',
  unfold: 'ctrl+alt+up',
  next: 'ctrl+alt+right',
  previous: 'ctrl+alt+left',
}
export const READY_TIMEOUT = 10_000
export const RESPONSE_TIMEOUT = 30_000
export const QUIET_MS = 500
export const POLL_MS = 150
export const NUMBERED_SESSION_PATTERN = /^(\d+)(?:\s+(.*))?$/u
export const KEY_HINT =
  'keys ctrl+alt: +z compose · +c inject & clear · +x clear · ↑/↓ fold · ←/→ switch'
