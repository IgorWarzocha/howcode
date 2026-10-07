import { isSelectedConversationView } from '@howcode/extensions/toolkit-plugins'
import {
  getLocalDraftProjectId,
  getPersistedConversationId,
  isLocalConversationId,
} from '@howcode/shared/conversation-ids'
import type { DesktopEvent } from '../desktop/types'
import { desktopQueryKeys, invokeDesktopActionQuery } from '../query/desktop-query'
import type { WorkspaceState } from '../state/workspace-model'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

export type DesktopEventSelectionState = Pick<
  WorkspaceState,
  | 'activeView'
  | 'selectedProjectId'
  | 'selectedThreadId'
  | 'selectedConversationId'
  | 'selectedInboxConversationId'
>

export function getVisibleDesktopConversationId(workspaceState: DesktopEventSelectionState) {
  return isSelectedConversationView(workspaceState.activeView)
    ? getPersistedConversationId(workspaceState.selectedConversationId)
    : workspaceState.activeView === 'inbox'
      ? (workspaceState.selectedInboxConversationId ?? null)
      : null
}

export function shouldAutoOpenStartedThread({
  reason,
  projectId,
  workspaceState,
}: {
  reason: Extract<DesktopEvent, { type: 'thread-update' }>['reason']
  projectId: string
  isChat?: boolean | undefined
  workspaceState: DesktopEventSelectionState
}) {
  if (reason !== 'start' || projectId !== workspaceState.selectedProjectId) {
    return false
  }

  // Do not let background runtime starts steal focus. User-initiated sends and explicit
  // thread creation open from their action result; ambient thread events should only update caches.
  return false
}

export function shouldDisplayStartedThreadForLocalDraft({
  reason,
  projectId,
  isChat,
  replacesConversationId,
  workspaceState,
}: {
  reason: Extract<DesktopEvent, { type: 'thread-update' }>['reason']
  projectId: string
  isChat?: boolean | undefined
  replacesConversationId?: string | null | undefined
  workspaceState: DesktopEventSelectionState
}) {
  const explicitlyReplacesSelectedDraft =
    isLocalConversationId(replacesConversationId) &&
    replacesConversationId === workspaceState.selectedConversationId
  if (reason !== 'start' && !explicitlyReplacesSelectedDraft) {
    return false
  }

  const localDraftProjectId = getLocalDraftProjectId(workspaceState.selectedConversationId)
  if (localDraftProjectId !== projectId) {
    return false
  }

  return (
    (workspaceState.activeView === 'chat' && isChat === true) ||
    ((workspaceState.activeView === 'thread' || workspaceState.activeView === 'project') &&
      isChat !== true)
  )
}

export async function refreshVisibleInboxThread({
  event,
  loadProjectThreads,
  queryClient,
}: {
  event: Extract<DesktopEvent, { type: 'thread-update' }>
  loadProjectThreads: (projectId: string) => Promise<unknown>
  queryClient: QueryClientLike
}) {
  await invokeDesktopActionQuery('inbox.mark-read', {
    conversationId: event.conversationId,
    projectId: event.projectId,
  })

  await Promise.all([
    loadProjectThreads(event.projectId),
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
  ])
}
