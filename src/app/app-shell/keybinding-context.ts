import type { KeybindingCommandId } from '../../../shared/keybindings'
import type { KeybindingRuntime } from './keybinding-runtime'

export const rendererCommandIds = new Set<KeybindingCommandId>([
  'app.commandPalette',
  'gitops.toggleChangedFiles',
  'terminal.focus',
  'terminal.clear',
  'thread.find',
  'sidebar.find',
  'composer.focus',
  'dictation.toggle',
])

export function eventTargetIsEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function eventTargetIsComposer(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('[data-composer-root="true"]') !== null
}

function dictationShortcutIsAllowed(event: KeyboardEvent, runtime: KeybindingRuntime) {
  return (
    eventTargetIsComposer(event.target) ||
    runtime.appController.state.activeView === 'gitops' ||
    runtime.appController.state.activeView === 'inbox'
  )
}

export function appShortcutCanRunFromTextInput(
  commandId: KeybindingCommandId,
  event: KeyboardEvent,
  runtime: KeybindingRuntime,
) {
  // Composer text input still lets app shortcuts through; normal text is unaffected because
  // only registered accelerators reach this point. Changed-files stays GitOps-panel scoped.
  if (commandId === 'gitops.toggleChangedFiles') return false
  if (commandId === 'dictation.toggle') return dictationShortcutIsAllowed(event, runtime)
  if (commandId === 'terminal.clear') return runtime.appController.state.terminalVisible
  return true
}

function interactiveLayerIsOpen() {
  return (
    document.querySelector(
      'dialog[open], [aria-modal="true"], [role="dialog"], [role="listbox"], .sidebar-popover-panel, .motion-popover',
    ) !== null
  )
}

function modalOrSettingsLayerIsOpen() {
  return document.querySelector('dialog[open], [aria-modal="true"], [role="dialog"]') !== null
}

export function appLevelShortcutsAreBlocked(
  commandId: KeybindingCommandId,
  runtime: KeybindingRuntime,
) {
  if (commandId === 'sidebar.toggle' || commandId === 'app.commandPalette') {
    return false
  }
  const { state } = runtime.appController
  if (commandId === 'composer.focus' || commandId === 'terminal.focus') {
    return (
      state.activeView === 'settings' ||
      state.settingsOpen ||
      state.settingsPanelOpen ||
      modalOrSettingsLayerIsOpen()
    )
  }
  if (commandId === 'terminal.toggle') {
    return state.activeView === 'settings' || state.settingsOpen || state.settingsPanelOpen
  }
  if (commandId === 'settings.open') return state.settingsPanelOpen || interactiveLayerIsOpen()
  return (
    state.activeView === 'settings' ||
    state.settingsOpen ||
    state.settingsPanelOpen ||
    interactiveLayerIsOpen()
  )
}
