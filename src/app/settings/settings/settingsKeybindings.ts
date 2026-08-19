import { isValidAccelerator, normalizeAccelerator } from '@howcode/shared/keybindings'
import type { AppSettings, KeybindingCommandId } from '../../desktop/types'

export type SettingsPlatform = 'mac' | 'windows' | 'linux'

export const keybindingCommandHelp: Record<KeybindingCommandId, string> = {
  'app.commandPalette': 'Open the command palette.',
  'settings.open': 'Open settings. Press again to return to the previous view.',
  'thread.new': 'Create a new thread in the current project.',
  'thread.find': 'Find in the current thread.',
  'sidebar.find': 'Focus sidebar search.',
  'sidebar.toggle': 'Show or hide the sidebar. Still works while settings is open.',
  'terminal.toggle': 'Open or close the terminal drawer.',
  'terminal.focus': 'Open the terminal drawer and focus it.',
  'terminal.clear': 'Clear the terminal when it is available.',
  'gitops.open': 'Open GitOps from code threads.',
  'gitops.toggleChangedFiles': 'Show or hide the changed files list in GitOps.',
  'thread.previousInProject': 'Move to the previous thread in the current context.',
  'thread.nextInProject': 'Move to the next thread in the current context.',
  'composer.submit': 'Submit the current prompt.',
  'composer.newline': 'Insert a newline in the prompt.',
  'composer.focus': 'Focus the prompt input.',
  'agent.interrupt': 'Stop the active run with a double Escape.',
  'dictation.toggle': 'Start or stop dictation from the composer.',
}

export const keybindingOrder: KeybindingCommandId[] = [
  'settings.open',
  'app.commandPalette',
  'sidebar.toggle',
  'thread.new',
  'thread.previousInProject',
  'thread.nextInProject',
  'thread.find',
  'sidebar.find',
  'terminal.toggle',
  'terminal.focus',
  'terminal.clear',
  'gitops.open',
  'gitops.toggleChangedFiles',
  'composer.submit',
  'composer.newline',
  'composer.focus',
  'dictation.toggle',
  'agent.interrupt',
]

export type KeybindingMutation =
  | { kind: 'set'; accelerator: string }
  | { kind: 'disable' }
  | { kind: 'reset' }

export function applyKeybindingMutation(
  keybindings: AppSettings['keybindings'],
  commandId: KeybindingCommandId,
  mutation: KeybindingMutation,
) {
  const nextKeybindings = { ...keybindings }
  if (mutation.kind === 'disable') {
    nextKeybindings[commandId] = null
  } else if (mutation.kind === 'reset') {
    delete nextKeybindings[commandId]
  } else {
    const normalized = normalizeAccelerator(mutation.accelerator)
    if (normalized && isValidAccelerator(normalized)) nextKeybindings[commandId] = normalized
    else delete nextKeybindings[commandId]
  }
  return nextKeybindings
}

export function getKeybindingOverride(
  appSettings: Pick<AppSettings, 'keybindings'>,
  commandId: KeybindingCommandId,
) {
  const override = appSettings.keybindings[commandId]
  return typeof override === 'string' ? override : ''
}

export function formatSettingsAccelerator(value: string, platform: SettingsPlatform) {
  const mac = platform === 'mac'
  const labels: Record<string, string> = mac
    ? {
        CmdOrCtrl: '⌘',
        Cmd: '⌘',
        Ctrl: '⌃',
        Alt: '⌥',
        Shift: '⇧',
        Escape: 'Esc',
        Space: 'Space',
      }
    : {
        CmdOrCtrl: 'Ctrl',
        Cmd: 'Cmd',
        Ctrl: 'Ctrl',
        Alt: 'Alt',
        Shift: 'Shift',
        Escape: 'Esc',
        Space: 'Space',
      }
  return value
    .split(' ')
    .map((chord) =>
      chord
        .split('+')
        .map((part) => labels[part] ?? part)
        .join(mac ? '' : '+'),
    )
    .join(' then ')
}

export function readSettingsPlatform(): SettingsPlatform {
  if (typeof navigator === 'undefined') return 'linux'
  const platform = navigator.platform.toLowerCase()
  if (platform.includes('mac')) return 'mac'
  if (platform.includes('win')) return 'windows'
  return 'linux'
}
