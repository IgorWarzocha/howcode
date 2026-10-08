import type { Dispatch, SetStateAction } from 'react'
import type {
  ChatData,
  ComposerState,
  DesktopEvent,
  WorkspaceNavigationState,
} from '../../desktop/types'
import type { WorkspaceAction } from '../../state/workspace-model'
import type { DesktopEventSelectionState } from '../desktop-event-sync'

export type DesktopEventQueryClient = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

type ChatEndEffect = (
  event: Extract<DesktopEvent, { type: 'chat-update' }>,
  activeView: DesktopEventSelectionState['activeView'],
) => void

export type DesktopChatEndContribution = {
  refreshChatList: ChatEndEffect
  refreshDirectoryState: ChatEndEffect
}

export type DesktopEventSyncRuntime = {
  desktopEventStateRef: React.RefObject<{
    chatEndContribution: DesktopChatEndContribution | undefined
    composerDirectoryId: string
    workspaceState: DesktopEventSelectionState
  }>
  dispatch: Dispatch<WorkspaceAction>
  loadDirectoryChats: (
    directoryId: string,
    options?: {
      replaceLocalDraftConversationId?: string | null | undefined
    },
  ) => Promise<unknown>
  localDraftConversationIdByPersistedConversationIdRef: React.RefObject<Map<string, string>>
  queryClient: DesktopEventQueryClient
  refreshWorkspaceNavigationState: () => Promise<unknown>
  scheduleShellStateRefresh: () => void
  setWorkspaceNavigationState: Dispatch<SetStateAction<WorkspaceNavigationState | null>>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setLiveChatData: Dispatch<SetStateAction<ChatData | null>>
  setChatHistoryCompactions: Dispatch<SetStateAction<number>>
}
