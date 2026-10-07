import type { Dispatch, SetStateAction } from 'react'
import type {
  ChatSidebarState,
  ComposerState,
  ProjectGitState,
  ThreadData,
} from '../../desktop/types'
import type { WorkspaceAction } from '../../state/workspace-model'
import type { DesktopEventSelectionState } from '../desktop-event-sync'

export type DesktopEventQueryClient = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

export type DesktopEventSyncRuntime = {
  desktopEventStateRef: React.RefObject<{
    codingEnabled?: boolean
    composerProjectId: string
    workspaceState: DesktopEventSelectionState
  }>
  dispatch: Dispatch<WorkspaceAction>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
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
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>
}
