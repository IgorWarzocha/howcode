import type { Dispatch, SetStateAction } from 'react'
import type { ChatSidebarState, ComposerState, DesktopEvent, ThreadData } from '../../desktop/types'
import type { WorkspaceAction } from '../../state/workspace-model'
import type { DesktopEventSelectionState } from '../desktop-event-sync'

export type DesktopEventQueryClient = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

type ThreadEndEffect = (
  event: Extract<DesktopEvent, { type: 'thread-update' }>,
  activeView: DesktopEventSelectionState['activeView'],
) => void

export type DesktopThreadEndContribution = {
  refreshThreadList: ThreadEndEffect
  refreshProjectState: ThreadEndEffect
}

export type DesktopEventSyncRuntime = {
  desktopEventStateRef: React.RefObject<{
    threadEndContribution: DesktopThreadEndContribution | undefined
    composerProjectId: string
    workspaceState: DesktopEventSelectionState
  }>
  dispatch: Dispatch<WorkspaceAction>
  loadProjectThreads: (
    projectId: string,
    options?: {
      chat?: boolean | undefined
      replaceLocalDraftConversationId?: string | null | undefined
    },
  ) => Promise<unknown>
  localDraftConversationIdByPersistedConversationIdRef: React.RefObject<Map<string, string>>
  queryClient: DesktopEventQueryClient
  refreshChatSidebarState: () => Promise<unknown>
  scheduleShellStateRefresh: () => void
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>
}
