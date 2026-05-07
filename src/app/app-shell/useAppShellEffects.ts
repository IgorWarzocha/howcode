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
import { getVisibleDesktopSessionPath, shouldAutoOpenStartedThread } from './desktop-event-sync'
import { useComposerGitStateSync } from './useComposerGitStateSync'
import { useDesktopEventSync } from './useDesktopEventSync'
import { useProjectShellSync } from './useProjectShellSync'
import { useTakeoverVisibilitySync } from './useTakeoverVisibilitySync'
import { useTerminalGitStateSync } from './useTerminalGitStateSync'
import {
  shouldCloseUtilityViewOnEscape,
  useUtilityViewEscape,
  useWatchedSessionSync,
} from './useWindowShellSync'

export { getVisibleDesktopSessionPath, shouldAutoOpenStartedThread, shouldCloseUtilityViewOnEscape }

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
    options?: { chat?: boolean | undefined },
  ) => Promise<unknown>
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  loadComposerState: (request?: {
    projectId?: string | null
    sessionPath?: string | null
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
    loadProjectThreads,
    loadArchivedThreads,
    dispatch,
    setArchivedThreads,
  })

  useTakeoverVisibilitySync({ shellAppSettings, workspaceState, dispatch })

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

  useWatchedSessionSync(workspaceState)
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
