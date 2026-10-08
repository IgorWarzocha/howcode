import {
  useCodingDesktopEventContribution,
  useCodingGitStateSync,
  useDirectoryShellSync,
  useTerminalGitStateSync,
} from '@howcode/components/coding/ui'
import { listDesktopTerminals, subscribeDesktopTerminal } from '@howcode/components/terminal/ui'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import type { Dispatch, SetStateAction } from 'react'
import type {
  AppSettings,
  ArchivedChat,
  ChatData,
  ComposerState,
  DirectoryGitState,
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
  loadDirectoryGitState,
  scheduleShellStateRefresh,
  refreshWorkspaceNavigationState,
  queryClient,
  dispatch,
  setArchivedChats,
  setComposerState,
  setWorkspaceNavigationState,
  setLiveChatData,
  setDirectoryGitState,
  setDirectoryGitLoading,
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
  loadComposerState: (request?: {
    directoryId?: string | null
    conversationId?: string | null
    composerProfile?: 'general' | 'coding' | null
  }) => Promise<ComposerState | null>
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  scheduleShellStateRefresh: () => void
  refreshWorkspaceNavigationState: () => Promise<unknown>
  queryClient: QueryClientLike
  dispatch: Dispatch<WorkspaceAction>
  setArchivedChats: Dispatch<SetStateAction<ArchivedChat[]>>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setWorkspaceNavigationState: Dispatch<SetStateAction<WorkspaceNavigationState | null>>
  setLiveChatData: Dispatch<SetStateAction<ChatData | null>>
  setDirectoryGitState: Dispatch<SetStateAction<DirectoryGitState | null>>
  setDirectoryGitLoading: Dispatch<SetStateAction<boolean>>
  setChatHistoryCompactions: Dispatch<SetStateAction<number>>
}) {
  useDirectoryShellSync({
    enabled: shellAppSettings != null && isToolkitComponentEnabled(shellAppSettings, 'coding'),
    directories,
    collapsedDirectoryIds,
    activeView: workspaceState.activeView,
    selectedDirectoryId: workspaceState.selectedDirectoryId,
    selectedChatId: workspaceState.selectedChatId,
    selectedConversationId: workspaceState.selectedConversationId,
    lastCodeChatSelection: workspaceState.lastCodeChatSelection,
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
  useCodingGitStateSync({
    activeView: workspaceState.activeView,
    composerDirectoryId,
    shellAppSettings,
    loadDirectoryGitState,
    setDirectoryGitState,
    setDirectoryGitLoading,
  })

  useWatchedConversationSync(workspaceState)
  useUtilityViewEscape({ activeView: workspaceState.activeView, dispatch })
  useTerminalGitStateSync({
    listDesktopTerminals,
    subscribeDesktopTerminal,
    enabled:
      shellAppSettings != null &&
      isToolkitComponentEnabled(shellAppSettings, 'terminal') &&
      isToolkitComponentEnabled(shellAppSettings, 'coding'),
    composerDirectoryId,
    loadDirectoryGitState,
    setDirectoryGitState,
  })

  const chatEndContribution = useCodingDesktopEventContribution({
    enabled: shellAppSettings != null && isToolkitComponentEnabled(shellAppSettings, 'coding'),
    composerDirectoryId,
    loadDirectoryChats,
    loadDirectoryGitState,
    setDirectoryGitState,
    queryClient,
  })

  useDesktopEventSync({
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
  })
}
