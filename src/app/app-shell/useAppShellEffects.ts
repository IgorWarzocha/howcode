import {
  useDirectoryDesktopEventContribution,
  useDirectoryShellSync,
} from '@howcode/components/working-directories/ui'
import type { ComposerStateRequest } from '@howcode/shared/desktop-composer-contracts'
import type { Dispatch, SetStateAction } from 'react'
import type {
  AppSettings,
  ArchivedChat,
  ChatData,
  ComposerState,
  InboxChat,
  WorkspaceNavigationState,
} from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import type { WorkingDirectory } from '../types'
import { useComposerStateSync } from './useComposerStateSync'
import { useDesktopEventSync } from './useDesktopEventSync'
import { useUtilityViewEscape, useWatchedConversationSync } from './useWindowShellSync'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: unknown) => void
  setQueriesData: (filters: { queryKey: readonly unknown[] }, updater: unknown) => void
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

export function useAppShellEffects({
  directories,
  collapsedDirectoryIds,
  workspaceState,
  selectedInboxChat,
  composerDirectoryId,
  shellComposerState,
  shellAppSettings,
  loadDirectoryChats,
  loadArchivedChats,
  loadComposerState,
  scheduleShellStateRefresh,
  refreshWorkspaceNavigationState,
  queryClient,
  dispatch,
  setArchivedChats,
  setComposerState,
  setWorkspaceNavigationState,
  setLiveChatData,
  setChatHistoryCompactions,
}: {
  directories: WorkingDirectory[]
  collapsedDirectoryIds: Record<string, boolean>
  workspaceState: WorkspaceState
  selectedInboxChat: InboxChat | null
  composerDirectoryId: string
  shellComposerState: ComposerState | null | undefined
  shellAppSettings: AppSettings | null | undefined
  loadDirectoryChats: (
    directoryId: string,
    options?: {
      replaceLocalDraftConversationId?: string | null | undefined
    },
  ) => Promise<unknown>
  loadArchivedChats: () => Promise<ArchivedChat[]>
  loadComposerState: (request?: ComposerStateRequest) => Promise<ComposerState | null>
  scheduleShellStateRefresh: () => void
  refreshWorkspaceNavigationState: () => Promise<unknown>
  queryClient: QueryClientLike
  dispatch: Dispatch<WorkspaceAction>
  setArchivedChats: Dispatch<SetStateAction<ArchivedChat[]>>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setWorkspaceNavigationState: Dispatch<SetStateAction<WorkspaceNavigationState | null>>
  setLiveChatData: Dispatch<SetStateAction<ChatData | null>>
  setChatHistoryCompactions: Dispatch<SetStateAction<number>>
}) {
  useDirectoryShellSync({
    enabled: shellAppSettings != null,
    directories,
    collapsedDirectoryIds,
    activeView: workspaceState.activeView,
    selectedDirectoryId: workspaceState.selectedDirectoryId,
    selectedConversationId: workspaceState.selectedConversationId,
    lastChatSelection: workspaceState.lastChatSelection,
    loadDirectoryChats,
    loadArchivedChats,
    dispatch,
    setArchivedChats,
  })

  useComposerStateSync({
    workspaceState,
    selectedInboxChat,
    composerDirectoryId,
    shellComposerState,
    shellAppSettings,
    loadComposerState,
    setComposerState,
  })
  useWatchedConversationSync(workspaceState)
  useUtilityViewEscape({ activeView: workspaceState.activeView, dispatch })

  const directoryChatEndContribution = useDirectoryDesktopEventContribution({
    enabled: shellAppSettings != null,
    loadDirectoryChats,
    queryClient,
  })
  useDesktopEventSync({
    chatEndContribution: directoryChatEndContribution,
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
  })
}
