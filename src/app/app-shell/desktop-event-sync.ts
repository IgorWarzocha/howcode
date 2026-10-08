import { isSelectedConversationView } from '@howcode/component-system/toolkit-components'
import {
  getLocalDraftDirectoryId,
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
  | 'composerProfile'
  | 'selectedDirectoryId'
  | 'selectedChatId'
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

export function shouldAutoOpenStartedChat({
  reason,
  directoryId,
  workspaceState,
}: {
  reason: Extract<DesktopEvent, { type: 'chat-update' }>['reason']
  directoryId: string
  composerProfile?: 'general' | 'coding' | undefined
  workspaceState: DesktopEventSelectionState
}) {
  if (reason !== 'start' || directoryId !== workspaceState.selectedDirectoryId) {
    return false
  }

  // Do not let background runtime starts steal focus. User-initiated sends and explicit
  // chat creation open from their action result; ambient chat events should only update caches.
  return false
}

export function shouldDisplayStartedChatForLocalDraft({
  reason,
  directoryId,
  composerProfile,
  replacesConversationId,
  workspaceState,
}: {
  reason: Extract<DesktopEvent, { type: 'chat-update' }>['reason']
  directoryId: string
  composerProfile?: 'general' | 'coding' | undefined
  replacesConversationId?: string | null | undefined
  workspaceState: DesktopEventSelectionState
}) {
  const explicitlyReplacesSelectedDraft =
    isLocalConversationId(replacesConversationId) &&
    replacesConversationId === workspaceState.selectedConversationId
  if (reason !== 'start' && !explicitlyReplacesSelectedDraft) {
    return false
  }

  const localDraftDirectoryId = getLocalDraftDirectoryId(workspaceState.selectedConversationId)
  if (localDraftDirectoryId !== directoryId) {
    return false
  }

  return (
    (workspaceState.activeView === 'chat' || workspaceState.activeView === 'directory') &&
    (composerProfile === undefined || composerProfile === workspaceState.composerProfile)
  )
}

export async function refreshVisibleInboxChat({
  event,
  loadDirectoryChats,
  queryClient,
}: {
  event: Extract<DesktopEvent, { type: 'chat-update' }>
  loadDirectoryChats: (directoryId: string) => Promise<unknown>
  queryClient: QueryClientLike
}) {
  await invokeDesktopActionQuery('inbox.mark-read', {
    conversationId: event.conversationId,
    directoryId: event.directoryId,
  })

  await Promise.all([
    loadDirectoryChats(event.directoryId),
    queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxChats() }),
  ])
}
