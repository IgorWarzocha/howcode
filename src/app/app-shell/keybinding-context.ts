import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import {
  componentRendererCommandIds,
  getComponentKeybindingPolicy,
} from '../component-system/toolkit-components'
import type { KeybindingRuntime } from './keybinding-runtime'

export const rendererCommandIds = {
  has(commandId: KeybindingCommandId) {
    return new Set<KeybindingCommandId>([
      'app.commandPalette',
      'chat.find',
      'sidebar.find',
      'composer.focus',
      ...componentRendererCommandIds(),
    ]).has(commandId)
  },
}

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

export function appShortcutCanRunFromTextInput(
  commandId: KeybindingCommandId,
  event: KeyboardEvent,
  runtime: KeybindingRuntime,
) {
  const policy = getComponentKeybindingPolicy(commandId)?.policy
  const { activeView, terminalVisible } = runtime.appController.workspace.state
  return (
    policy?.allowFromTextInput?.({
      composerTarget: eventTargetIsComposer(event.target),
      activeView,
      terminalVisible,
    }) ?? true
  )
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

function toolkitShortcutIsDisabled(commandId: KeybindingCommandId, runtime: KeybindingRuntime) {
  const settings = runtime.appController.desktop.shellState?.appSettings
  const contribution = getComponentKeybindingPolicy(commandId)
  return contribution?.componentId
    ? !isToolkitComponentEnabled(settings, contribution.componentId)
    : false
}

export function appLevelShortcutsAreBlocked(
  commandId: KeybindingCommandId,
  runtime: KeybindingRuntime,
) {
  if (toolkitShortcutIsDisabled(commandId, runtime)) return true
  const { state } = runtime.appController.workspace
  if (commandId === 'sidebar.toggle' || commandId === 'app.commandPalette') {
    return false
  }
  const layer = getComponentKeybindingPolicy(commandId)?.policy.layer
  if (commandId === 'composer.focus' || layer === 'modal') {
    return (
      state.activeView === 'settings' ||
      state.settingsOpen ||
      state.settingsPanelOpen ||
      modalOrSettingsLayerIsOpen()
    )
  }
  if (layer === 'settings') {
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
