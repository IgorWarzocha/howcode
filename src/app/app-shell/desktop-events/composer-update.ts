import type { DesktopEvent } from '../../desktop/types'
import { getVisibleDesktopSessionPath } from '../desktop-event-sync'
import { applyPiExtensionUiState, getComposerExtensionUi } from './pi-extension-ui-state'
import type { DesktopEventSyncRuntime } from './runtime'

function shouldApplyComposerUpdate(input: {
  event: Extract<DesktopEvent, { type: 'composer-update' }>
  latestComposerProjectId: string
  latestWorkspaceState: DesktopEventSyncRuntime['desktopEventStateRef']['current']['workspaceState']
  localDraftSessionPathByPersistedSessionPathRef: React.RefObject<Map<string, string>>
  visibleSessionPath: string | null
}) {
  const aliasedLocalDraftSessionPath = input.event.sessionPath
    ? input.localDraftSessionPathByPersistedSessionPathRef.current.get(input.event.sessionPath)
    : null
  if (input.event.sessionPath) {
    return (
      input.event.sessionPath === input.visibleSessionPath ||
      aliasedLocalDraftSessionPath === input.latestWorkspaceState.selectedSessionPath
    )
  }
  return (
    input.event.projectId === input.latestComposerProjectId &&
    ((input.latestWorkspaceState.activeView !== 'thread' &&
      input.latestWorkspaceState.activeView !== 'gitops' &&
      input.latestWorkspaceState.activeView !== 'chat') ||
      input.visibleSessionPath === null)
  )
}

export function handleComposerUpdateEvent(
  runtime: DesktopEventSyncRuntime,
  event: Extract<DesktopEvent, { type: 'composer-update' }>,
) {
  const { composerProjectId: latestComposerProjectId, workspaceState: latestWorkspaceState } =
    runtime.desktopEventStateRef.current
  const visibleSessionPath = getVisibleDesktopSessionPath(latestWorkspaceState)
  if (
    shouldApplyComposerUpdate({
      event,
      latestComposerProjectId,
      latestWorkspaceState,
      localDraftSessionPathByPersistedSessionPathRef:
        runtime.localDraftSessionPathByPersistedSessionPathRef,
      visibleSessionPath,
    })
  )
    runtime.setComposerState(event.composer)
  applyPiExtensionUiState({
    extensionUi: getComposerExtensionUi(event.composer),
    sessionPath: event.sessionPath,
    setPiExtensionUiStateBySession: runtime.setPiExtensionUiStateBySession,
  })
}
