import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import type {
  ChatData,
  ComposerState,
  DesktopEvent,
  WorkspaceNavigationState,
} from '../desktop/types'
import { subscribeDesktopEvents } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import {
  type DesktopEventSyncRuntime,
  handleDesktopEvent,
  type QueryClientLike,
} from './desktop-event-handlers'
import type { DesktopEventSelectionState } from './desktop-event-sync'
import type { DesktopChatEndContribution } from './desktop-events/runtime'

type UseDesktopEventSyncInput = {
  chatEndContribution?: DesktopChatEndContribution | undefined
  composerDirectoryId: string
  workspaceState: WorkspaceState
  loadDirectoryChats: (
    directoryId: string,
    options?: {
      replaceLocalDraftConversationId?: string | null | undefined
    },
  ) => Promise<unknown>
  scheduleShellStateRefresh: () => void
  refreshWorkspaceNavigationState: () => Promise<unknown>
  queryClient: QueryClientLike
  dispatch: Dispatch<WorkspaceAction>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setWorkspaceNavigationState: Dispatch<SetStateAction<WorkspaceNavigationState | null>>
  setLiveChatData: Dispatch<SetStateAction<ChatData | null>>
  setChatHistoryCompactions: Dispatch<SetStateAction<number>>
}

export function useDesktopEventSync({
  chatEndContribution,
  composerDirectoryId,
  workspaceState,
  loadDirectoryChats,
  scheduleShellStateRefresh,
  refreshWorkspaceNavigationState,
  queryClient,
  dispatch,
  setComposerState,
  setWorkspaceNavigationState,
  setLiveChatData,
  setChatHistoryCompactions,
}: UseDesktopEventSyncInput) {
  const desktopEventStateRef = useRef({
    chatEndContribution,
    composerDirectoryId,
    workspaceState: {
      activeView: workspaceState.activeView,
      composerProfile: workspaceState.composerProfile,
      selectedDirectoryId: workspaceState.selectedDirectoryId,
      selectedChatId: workspaceState.selectedChatId,
      selectedConversationId: workspaceState.selectedConversationId,
      selectedInboxConversationId: workspaceState.selectedInboxConversationId,
    } satisfies DesktopEventSelectionState,
  })
  const localDraftConversationIdByPersistedConversationIdRef = useRef(new Map<string, string>())

  useEffect(() => {
    desktopEventStateRef.current = {
      chatEndContribution,
      composerDirectoryId,
      workspaceState: {
        activeView: workspaceState.activeView,
        composerProfile: workspaceState.composerProfile,
        selectedDirectoryId: workspaceState.selectedDirectoryId,
        selectedChatId: workspaceState.selectedChatId,
        selectedConversationId: workspaceState.selectedConversationId,
        selectedInboxConversationId: workspaceState.selectedInboxConversationId,
      },
    }
  }, [
    chatEndContribution,
    composerDirectoryId,
    workspaceState.activeView,
    workspaceState.composerProfile,
    workspaceState.selectedDirectoryId,
    workspaceState.selectedChatId,
    workspaceState.selectedInboxConversationId,
    workspaceState.selectedConversationId,
  ])

  useEffect(() => {
    // Keep the subscription stable. Re-subscribing on every selection change can drop in-flight
    // chat updates when a GUI-started chat flips from local draft to persisted session path.
    const runtime: DesktopEventSyncRuntime = {
      dispatch,
      loadDirectoryChats,
      queryClient,
      refreshWorkspaceNavigationState,
      scheduleShellStateRefresh,
      setWorkspaceNavigationState,
      setComposerState,
      setLiveChatData,
      setChatHistoryCompactions,
      desktopEventStateRef,
      localDraftConversationIdByPersistedConversationIdRef,
    }
    return subscribeDesktopEvents((event: DesktopEvent) => handleDesktopEvent(runtime, event))
  }, [
    dispatch,
    loadDirectoryChats,
    queryClient,
    refreshWorkspaceNavigationState,
    scheduleShellStateRefresh,
    setWorkspaceNavigationState,
    setComposerState,
    setLiveChatData,
    setChatHistoryCompactions,
  ])
}
