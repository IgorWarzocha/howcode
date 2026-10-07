import type { Dispatch, SetStateAction } from 'react'
import type {
  AppSettings,
  ArchivedThread,
  ChatSidebarState,
  ComposerState,
  InboxThread,
  ProjectGitState,
  ThreadData,
} from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import type { Project } from '../types'
import { useComposerGitStateSync } from './useComposerGitStateSync'
import { useDesktopEventSync } from './useDesktopEventSync'
import { useProjectShellSync } from './useProjectShellSync'
import { useTerminalGitStateSync } from './useTerminalGitStateSync'
import { useUtilityViewEscape, useWatchedConversationSync } from './useWindowShellSync'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void
  setQueriesData: (filters: { queryKey: readonly unknown[] }, updater: unknown) => void
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

export function useAppShellEffects({
  projects,
  collapsedProjectIds,
  workspaceState,
  selectedInboxThread,
  composerProjectId,
  shellComposerState,
  shellAppSettings,
  loadProjectThreads,
  loadArchivedThreads,
  loadComposerState,
  loadProjectGitState,
  scheduleShellStateRefresh,
  refreshChatSidebarState,
  queryClient,
  dispatch,
  setArchivedThreads,
  setComposerState,
  setChatSidebarState,
  setLiveThreadData,
  setProjectGitState,
  setProjectGitLoading,
  setThreadHistoryCompactions,
}: {
  projects: Project[]
  collapsedProjectIds: Record<string, boolean>
  workspaceState: WorkspaceState
  selectedInboxThread: InboxThread | null
  composerProjectId: string
  shellComposerState: ComposerState | null | undefined
  shellAppSettings: AppSettings | null | undefined
  loadProjectThreads: (
    projectId: string,
    options?: {
      chat?: boolean | undefined
      replaceLocalDraftConversationId?: string | null | undefined
    },
  ) => Promise<unknown>
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  loadComposerState: (request?: {
    projectId?: string | null
    conversationId?: string | null
    composerMode?: 'chat' | 'code' | null
  }) => Promise<ComposerState | null>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  scheduleShellStateRefresh: () => void
  refreshChatSidebarState: () => Promise<unknown>
  queryClient: QueryClientLike
  dispatch: Dispatch<WorkspaceAction>
  setArchivedThreads: Dispatch<SetStateAction<ArchivedThread[]>>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  setProjectGitLoading: Dispatch<SetStateAction<boolean>>
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>
}) {
  useProjectShellSync({
    projects,
    collapsedProjectIds,
    activeView: workspaceState.activeView,
    selectedProjectId: workspaceState.selectedProjectId,
    selectedThreadId: workspaceState.selectedThreadId,
    selectedConversationId: workspaceState.selectedConversationId,
    lastCodeThreadSelection: workspaceState.lastCodeThreadSelection,
    loadProjectThreads,
    loadArchivedThreads,
    dispatch,
    setArchivedThreads,
  })

  useComposerGitStateSync({
    workspaceState,
    selectedInboxThread,
    composerProjectId,
    shellComposerState,
    shellAppSettings,
    loadComposerState,
    loadProjectGitState,
    setComposerState,
    setProjectGitState,
    setProjectGitLoading,
  })

  useWatchedConversationSync(workspaceState)
  useUtilityViewEscape({ activeView: workspaceState.activeView, dispatch })
  useTerminalGitStateSync({ composerProjectId, loadProjectGitState, setProjectGitState })

  useDesktopEventSync({
    composerProjectId,
    workspaceState,
    loadProjectThreads,
    loadProjectGitState,
    scheduleShellStateRefresh,
    refreshChatSidebarState,
    queryClient,
    dispatch,
    setComposerState,
    setChatSidebarState,
    setLiveThreadData,
    setProjectGitState,
    setThreadHistoryCompactions,
  })
}
