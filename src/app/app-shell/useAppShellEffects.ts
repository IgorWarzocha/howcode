import {
  useCodingDesktopEventContribution,
  useCodingGitStateSync,
  useProjectShellSync,
  useTerminalGitStateSync,
} from '@howcode/plugins/coding/ui'
import { listDesktopTerminals, subscribeDesktopTerminal } from '@howcode/plugins/terminal/ui'
import { isToolkitExtensionEnabled } from '@howcode/shared/toolkit-extensions'
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
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import type { Project } from '../types'
import { useComposerStateSync } from './useComposerStateSync'
import { useDesktopEventSync } from './useDesktopEventSync'
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
    enabled: shellAppSettings != null && isToolkitExtensionEnabled(shellAppSettings, 'coding'),
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

  useComposerStateSync({
    workspaceState,
    selectedInboxThread,
    composerProjectId,
    shellComposerState,
    shellAppSettings,
    loadComposerState,
    setComposerState,
  })
  useCodingGitStateSync({
    activeView: workspaceState.activeView,
    composerProjectId,
    shellAppSettings,
    loadProjectGitState,
    setProjectGitState,
    setProjectGitLoading,
  })

  useWatchedConversationSync(workspaceState)
  useUtilityViewEscape({ activeView: workspaceState.activeView, dispatch })
  useTerminalGitStateSync({
    listDesktopTerminals,
    subscribeDesktopTerminal,
    enabled:
      shellAppSettings != null &&
      isToolkitExtensionEnabled(shellAppSettings, 'terminal') &&
      isToolkitExtensionEnabled(shellAppSettings, 'coding'),
    composerProjectId,
    loadProjectGitState,
    setProjectGitState,
  })

  const threadEndContribution = useCodingDesktopEventContribution({
    enabled: shellAppSettings != null && isToolkitExtensionEnabled(shellAppSettings, 'coding'),
    composerProjectId,
    loadProjectThreads,
    loadProjectGitState,
    setProjectGitState,
    queryClient,
  })

  useDesktopEventSync({
    threadEndContribution,
    composerProjectId,
    workspaceState,
    loadProjectThreads,
    scheduleShellStateRefresh,
    refreshChatSidebarState,
    queryClient,
    dispatch,
    setComposerState,
    setChatSidebarState,
    setLiveThreadData,
    setThreadHistoryCompactions,
  })
}
