import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import type {
  ChatSidebarState,
  ComposerState,
  DesktopEvent,
  PiExtensionUiState,
  ProjectGitState,
  ThreadData,
} from '../desktop/types'
import { subscribeDesktopEvents } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import {
  type DesktopEventSyncRuntime,
  handleDesktopEvent,
  type QueryClientLike,
} from './desktop-event-handlers'
import type { DesktopEventSelectionState } from './desktop-event-sync'

type UseDesktopEventSyncInput = {
  composerProjectId: string
  workspaceState: WorkspaceState
  loadProjectThreads: (
    projectId: string,
    options?: {
      chat?: boolean | undefined
      replaceLocalDraftSessionPath?: string | null | undefined
    },
  ) => Promise<unknown>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  scheduleShellStateRefresh: () => void
  refreshChatSidebarState: () => Promise<unknown>
  queryClient: QueryClientLike
  dispatch: Dispatch<WorkspaceAction>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  setPiExtensionUiStateBySession: Dispatch<SetStateAction<Record<string, PiExtensionUiState>>>
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>
}

export function useDesktopEventSync({
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
  setPiExtensionUiStateBySession,
  setProjectGitState,
  setThreadHistoryCompactions,
}: UseDesktopEventSyncInput) {
  const desktopEventStateRef = useRef({
    composerProjectId,
    workspaceState: {
      activeView: workspaceState.activeView,
      selectedProjectId: workspaceState.selectedProjectId,
      selectedThreadId: workspaceState.selectedThreadId,
      selectedSessionPath: workspaceState.selectedSessionPath,
      selectedInboxSessionPath: workspaceState.selectedInboxSessionPath,
      takeoverVisible: workspaceState.takeoverVisible,
    } satisfies DesktopEventSelectionState,
  })
  const localDraftSessionPathByPersistedSessionPathRef = useRef(new Map<string, string>())

  useEffect(() => {
    desktopEventStateRef.current = {
      composerProjectId,
      workspaceState: {
        activeView: workspaceState.activeView,
        selectedProjectId: workspaceState.selectedProjectId,
        selectedThreadId: workspaceState.selectedThreadId,
        selectedSessionPath: workspaceState.selectedSessionPath,
        selectedInboxSessionPath: workspaceState.selectedInboxSessionPath,
        takeoverVisible: workspaceState.takeoverVisible,
      },
    }
  }, [
    composerProjectId,
    workspaceState.activeView,
    workspaceState.selectedProjectId,
    workspaceState.selectedThreadId,
    workspaceState.selectedInboxSessionPath,
    workspaceState.selectedSessionPath,
    workspaceState.takeoverVisible,
  ])

  useEffect(() => {
    // Keep the subscription stable. Re-subscribing on every selection change can drop in-flight
    // thread updates when a GUI-started thread flips from local draft to persisted session path.
    const runtime: DesktopEventSyncRuntime = {
      dispatch,
      loadProjectGitState,
      loadProjectThreads,
      queryClient,
      refreshChatSidebarState,
      scheduleShellStateRefresh,
      setChatSidebarState,
      setComposerState,
      setLiveThreadData,
      setPiExtensionUiStateBySession,
      setProjectGitState,
      setThreadHistoryCompactions,
      desktopEventStateRef,
      localDraftSessionPathByPersistedSessionPathRef,
    }
    return subscribeDesktopEvents((event: DesktopEvent) => handleDesktopEvent(runtime, event))
  }, [
    dispatch,
    loadProjectGitState,
    loadProjectThreads,
    queryClient,
    refreshChatSidebarState,
    scheduleShellStateRefresh,
    setChatSidebarState,
    setComposerState,
    setLiveThreadData,
    setPiExtensionUiStateBySession,
    setProjectGitState,
    setThreadHistoryCompactions,
  ])
}
