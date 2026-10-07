import type { DesktopEvent } from '../../desktop/types'
import { getVisibleDesktopConversationId } from '../desktop-event-sync'
import type { DesktopEventSyncRuntime } from './runtime'

function shouldApplyComposerUpdate(input: {
  event: Extract<DesktopEvent, { type: 'composer-update' }>
  latestComposerProjectId: string
  latestWorkspaceState: DesktopEventSyncRuntime['desktopEventStateRef']['current']['workspaceState']
  localDraftConversationIdByPersistedConversationIdRef: React.RefObject<Map<string, string>>
  visibleConversationId: string | null
}) {
  const aliasedLocalDraftConversationId = input.event.conversationId
    ? input.localDraftConversationIdByPersistedConversationIdRef.current.get(
        input.event.conversationId,
      )
    : null
  if (input.event.conversationId) {
    return (
      input.event.conversationId === input.visibleConversationId ||
      aliasedLocalDraftConversationId === input.latestWorkspaceState.selectedConversationId
    )
  }
  return (
    input.event.projectId === input.latestComposerProjectId &&
    ((input.latestWorkspaceState.activeView !== 'thread' &&
      input.latestWorkspaceState.activeView !== 'gitops' &&
      input.latestWorkspaceState.activeView !== 'chat') ||
      input.visibleConversationId === null)
  )
}

export function handleComposerUpdateEvent(
  runtime: DesktopEventSyncRuntime,
  event: Extract<DesktopEvent, { type: 'composer-update' }>,
) {
  const { composerProjectId: latestComposerProjectId, workspaceState: latestWorkspaceState } =
    runtime.desktopEventStateRef.current
  const visibleConversationId = getVisibleDesktopConversationId(latestWorkspaceState)
  if (
    shouldApplyComposerUpdate({
      event,
      latestComposerProjectId,
      latestWorkspaceState,
      localDraftConversationIdByPersistedConversationIdRef:
        runtime.localDraftConversationIdByPersistedConversationIdRef,
      visibleConversationId,
    })
  )
    runtime.setComposerState(event.composer)
}
