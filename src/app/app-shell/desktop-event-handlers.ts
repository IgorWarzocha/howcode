import type { DesktopEvent } from '../desktop/types'
import { handleChatUpdateEvent } from './desktop-events/chat-update'
import { handleComposerUpdateEvent } from './desktop-events/composer-update'
import type { DesktopEventQueryClient, DesktopEventSyncRuntime } from './desktop-events/runtime'
import { dispatchHowcodeKeybindingCommand } from './keybinding-events'

export type { DesktopEventSyncRuntime }
export type QueryClientLike = DesktopEventQueryClient

function handleKeybindingCommandEvent(
  runtime: DesktopEventSyncRuntime,
  event: Extract<DesktopEvent, { type: 'keybinding-command' }>,
) {
  const { activeView } = runtime.desktopEventStateRef.current.workspaceState
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
    case 'chat-update':
      handleChatUpdateEvent(runtime, event)
      return
    default:
      // Update, dictation, diff, and artifact events have feature-owned subscriptions.
      return
  }
}
