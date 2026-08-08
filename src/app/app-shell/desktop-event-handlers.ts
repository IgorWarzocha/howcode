import { keybindingCommandIsActiveInMode } from '@howcode/shared/keybindings'
import type { DesktopEvent } from '../desktop/types'
import { handleComposerUpdateEvent } from './desktop-events/composer-update'
import { applyPiExtensionUiState } from './desktop-events/pi-extension-ui-state'
import type { DesktopEventQueryClient, DesktopEventSyncRuntime } from './desktop-events/runtime'
import {
  handleSessionTreeRefreshEvent,
  handleThreadUpdateEvent,
} from './desktop-events/thread-update'
import { dispatchHowcodeKeybindingCommand } from './keybinding-events'

export type { DesktopEventSyncRuntime }
export type QueryClientLike = DesktopEventQueryClient

function handleKeybindingCommandEvent(
  runtime: DesktopEventSyncRuntime,
  event: Extract<DesktopEvent, { type: 'keybinding-command' }>,
) {
  const { activeView, takeoverVisible } = runtime.desktopEventStateRef.current.workspaceState
  const mode = takeoverVisible ? 'pi-tui' : 'desktop'
  if (!keybindingCommandIsActiveInMode(event.commandId, mode)) return
  const allowedOverSettings =
    event.commandId === 'settings.open' ||
    event.commandId === 'sidebar.toggle' ||
    event.commandId === 'app.commandPalette'
  if (activeView === 'settings' && !allowedOverSettings) return
  dispatchHowcodeKeybindingCommand(event.commandId)
}

export function handleDesktopEvent(runtime: DesktopEventSyncRuntime, event: DesktopEvent) {
  switch (event.type) {
    case 'shell-state-refresh':
      runtime.scheduleShellStateRefresh()
      return
    case 'keybinding-command':
      handleKeybindingCommandEvent(runtime, event)
      return
    case 'composer-update':
      handleComposerUpdateEvent(runtime, event)
      return
    case 'pi-extension-ui-update':
      applyPiExtensionUiState({
        extensionUi: event.extensionUi,
        sessionPath: event.sessionPath,
        setPiExtensionUiStateBySession: runtime.setPiExtensionUiStateBySession,
      })
      return
    case 'thread-update':
      handleThreadUpdateEvent(runtime, event)
      return
    case 'session-tree-refresh':
      handleSessionTreeRefreshEvent(runtime, event)
      return
    default:
      // Update, dictation, diff, and artifact events have feature-owned subscriptions.
      return
  }
}
