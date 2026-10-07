import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import type { ChatSidebarState, ComposerState, DesktopEvent, ThreadData } from '../desktop/types'
import { subscribeDesktopEvents } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import {
  type DesktopEventSyncRuntime,
  handleDesktopEvent,
  type QueryClientLike,
} from './desktop-event-handlers'
import type { DesktopEventSelectionState } from './desktop-event-sync'
import type { DesktopThreadEndContribution } from './desktop-events/runtime'

type UseDesktopEventSyncInput = {
  threadEndContribution?: DesktopThreadEndContribution | undefined
  composerProjectId: string
  workspaceState: WorkspaceState
  loadProjectThreads: (
    projectId: string,
    options?: {
      chat?: boolean | undefined
      replaceLocalDraftConversationId?: string | null | undefined
    },
  ) => Promise<unknown>
  scheduleShellStateRefresh: () => void
  refreshChatSidebarState: () => Promise<unknown>
  queryClient: QueryClientLike
  dispatch: Dispatch<WorkspaceAction>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>
}

export function useDesktopEventSync({
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
}: UseDesktopEventSyncInput) {
  const desktopEventStateRef = useRef({
    threadEndContribution,
    composerProjectId,
    workspaceState: {
      activeView: workspaceState.activeView,
      selectedProjectId: workspaceState.selectedProjectId,
      selectedThreadId: workspaceState.selectedThreadId,
      selectedConversationId: workspaceState.selectedConversationId,
      selectedInboxConversationId: workspaceState.selectedInboxConversationId,
    } satisfies DesktopEventSelectionState,
  })
  const localDraftConversationIdByPersistedConversationIdRef = useRef(new Map<string, string>())

  useEffect(() => {
    desktopEventStateRef.current = {
      threadEndContribution,
      composerProjectId,
      workspaceState: {
        activeView: workspaceState.activeView,
        selectedProjectId: workspaceState.selectedProjectId,
        selectedThreadId: workspaceState.selectedThreadId,
        selectedConversationId: workspaceState.selectedConversationId,
        selectedInboxConversationId: workspaceState.selectedInboxConversationId,
      },
    }
  }, [
    threadEndContribution,
    composerProjectId,
    workspaceState.activeView,
    workspaceState.selectedProjectId,
    workspaceState.selectedThreadId,
    workspaceState.selectedInboxConversationId,
    workspaceState.selectedConversationId,
  ])

  useEffect(() => {
    // Keep the subscription stable. Re-subscribing on every selection change can drop in-flight
    // thread updates when a GUI-started thread flips from local draft to persisted session path.
    const runtime: DesktopEventSyncRuntime = {
      dispatch,
      loadProjectThreads,
      queryClient,
      refreshChatSidebarState,
      scheduleShellStateRefresh,
      setChatSidebarState,
      setComposerState,
      setLiveThreadData,
      setThreadHistoryCompactions,
      desktopEventStateRef,
      localDraftConversationIdByPersistedConversationIdRef,
    }
    return subscribeDesktopEvents((event: DesktopEvent) => handleDesktopEvent(runtime, event))
  }, [
    dispatch,
    loadProjectThreads,
    queryClient,
    refreshChatSidebarState,
    scheduleShellStateRefresh,
    setChatSidebarState,
    setComposerState,
    setLiveThreadData,
    setThreadHistoryCompactions,
  ])
}
