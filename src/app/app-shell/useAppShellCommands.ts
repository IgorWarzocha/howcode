import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { isLocalConversationId } from '@howcode/shared/conversation-ids'
import type { ToolkitComponentSettings } from '@howcode/shared/toolkit-components'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { isWorkspaceViewEnabled } from '../component-system/toolkit-components'
import type { DesktopActionResult, InboxChat, WorkspaceNavigationState } from '../desktop/types'
import { getGitRendererApi } from '../git-integration/client'
import { forgetLocalDraftChat } from '../hooks/useDesktopDirectoryChats'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import { useTerminalCommands, useTerminalEnabled } from '../terminal-integration'
import type { View, WorkingDirectory } from '../types'
import { findWorkspaceForDirectory } from './app-routes'
import { removeDirectoryChatFromShellState } from './directory-chat-cache'
import { getDirectorySelectionAction } from './scoped-directory-view'
import { CHAT_CYCLE_OPEN_ACTION_DELAY_MS, useScheduledChatOpen } from './useScheduledChatOpen'

type HandleAction = (
  action:
    | 'chats.collapse-all'
    | 'directory.collapse'
    | 'directory.expand'
    | 'chat.open'
    | 'inbox.mark-read'
    | 'inbox.dismiss',
  payload?: Record<string, unknown>,
) => Promise<DesktopActionResult | null>

type UseAppShellCommandsInput = {
  navigation: WorkspaceNavigationState | null
  directories: WorkingDirectory[]
  toolkitSettings: ToolkitComponentSettings | undefined
  collapsedDirectoryIds: Record<string, boolean>
  composerDirectoryId: string
  dispatch: Dispatch<WorkspaceAction>
  handleAction: HandleAction
  queryClient: QueryClient
  setChatHistoryCompactions: Dispatch<SetStateAction<number>>
  setChatQueryDeferred: Dispatch<SetStateAction<boolean>>
  setSettingsOpenTarget: Dispatch<SetStateAction<SettingsOpenTarget | null>>
  workspaceState: WorkspaceState
}

export function useAppShellCommands({
  navigation,
  directories,
  toolkitSettings,
  collapsedDirectoryIds,
  composerDirectoryId,
  dispatch,
  handleAction,
  queryClient,
  setSettingsOpenTarget,
  setChatHistoryCompactions,
  setChatQueryDeferred,
  workspaceState,
}: UseAppShellCommandsInput) {
  const scheduleChatOpenAction = useScheduledChatOpen({
    dispatch,
    handleAction,
    setChatQueryDeferred,
    workspaceState,
  })

  const { handleToggleTerminal, handleCloseTerminalDrawer } = useTerminalCommands({
    dispatch,
    enabled: useTerminalEnabled(toolkitSettings),
  })
  const createGitCommands = () =>
    getGitRendererApi()?.createGitWorkspaceCommands({ composerDirectoryId, dispatch, queryClient })
  const handleOpenGitOpsView = (options: { filePath?: string | null } = {}) =>
    createGitCommands()?.handleOpenGitOpsView(options)
  const handleCloseGitOpsView = () => createGitCommands()?.handleCloseGitOpsView()
  const handleOpenWorktreeDiffFile = (path: string) =>
    createGitCommands()?.handleOpenWorktreeDiffFile(path)

  const handleShowView = (view: View, target?: SettingsOpenTarget) => {
    const enabledView = isWorkspaceViewEnabled(toolkitSettings, view) ? view : 'chat'
    if (enabledView === 'settings') {
      setSettingsOpenTarget(target ?? null)
    }
    dispatch({ type: 'show-view', view: enabledView })
  }

  const handleShowLanding = () => {
    dispatch({ type: 'show-landing' })
  }

  const handleCloseUtilityView = () => {
    dispatch({ type: 'close-utility-view' })
  }

  const handleShowWorkspace = () => {
    if (
      workspaceState.activeView.startsWith('component:') &&
      workspaceState.utilityViewReturnState &&
      ['chat', 'workspace', 'directory', 'directories'].includes(
        workspaceState.utilityViewReturnState.activeView,
      )
    ) {
      dispatch({ type: 'close-utility-view' })
      return
    }
    dispatch({
      type: 'select-workspace',
      workspaceId: workspaceState.selectedWorkspaceId,
      directoryId: workspaceState.hasSelectedDirectory ? workspaceState.selectedDirectoryId : null,
    })
  }

  const handleCollapseAll = () => {
    dispatch({ type: 'collapse-all-directories' })
    void handleAction('chats.collapse-all')
  }

  const handleToggleDirectoryCollapse = (directoryId: string) => {
    const nextCollapsed = !collapsedDirectoryIds[directoryId]
    dispatch({ type: 'toggle-directory-collapse', directoryId })
    void handleAction(nextCollapsed ? 'directory.collapse' : 'directory.expand', { directoryId })
  }

  const clearSelectedUnstartedDraft = () => {
    const selectedConversationId = workspaceState.selectedConversationId
    const selectedDirectoryId = workspaceState.selectedDirectoryId
    if (!(selectedDirectoryId && isLocalConversationId(selectedConversationId))) return

    const localConversationId = selectedConversationId ?? ''
    forgetLocalDraftChat(selectedDirectoryId, localConversationId)
    removeDirectoryChatFromShellState(queryClient, selectedDirectoryId, localConversationId)
  }

  const handleChatOpen = (
    directoryId: string,
    chatId: string,
    conversationId: string,
    branchName?: string | null | undefined,
  ) => {
    clearSelectedUnstartedDraft()
    setChatHistoryCompactions(0)
    const workspace = navigation?.workspaces.find((item) =>
      item.chats.some(
        (candidate) => candidate.id === chatId || candidate.conversationId === conversationId,
      ),
    )
    dispatch({
      type: 'open-chat',
      directoryId,
      chatId,
      conversationId,
      workspaceId: workspace?.id,
    })
    scheduleChatOpenAction({
      directoryId,
      chatId,
      conversationId,
      branchName,
    })
  }

  const handleChatCycle = (directoryId: string, chatId: string, conversationId: string) => {
    setChatHistoryCompactions(0)
    const workspace = navigation?.workspaces.find((item) =>
      item.chats.some((chat) => chat.id === chatId),
    )
    dispatch({
      type: 'preview-chat',
      directoryId,
      chatId,
      workspaceId: workspace?.id,
    })
    scheduleChatOpenAction({
      directoryId,
      chatId,
      conversationId,
      delayMs: CHAT_CYCLE_OPEN_ACTION_DELAY_MS,
      deferChatQuery: true,
      commitLocally: true,
    })
  }

  const handleSelectInboxChat = (chat: InboxChat) => {
    dispatch({ type: 'select-inbox-chat', conversationId: chat.conversationId })

    if (chat.unread) {
      void handleAction('inbox.mark-read', {
        directoryId: chat.directoryId,
        conversationId: chat.conversationId,
      })
    }
  }

  const handleDismissInboxChat = (chat: InboxChat) => {
    void handleAction('inbox.dismiss', {
      directoryId: chat.directoryId,
      conversationId: chat.conversationId,
    })
  }

  const handleLoadEarlierMessages = (targetHistoryCompactions?: number | undefined) => {
    if (typeof targetHistoryCompactions === 'number' && Number.isFinite(targetHistoryCompactions)) {
      setChatHistoryCompactions(Math.max(0, Math.floor(targetHistoryCompactions)))
      return
    }

    setChatHistoryCompactions((current) => current + 1)
  }

  return {
    handleCloseGitOpsView,
    handleCloseUtilityView,
    handleCollapseAll,
    handleDismissInboxChat,
    handleLoadEarlierMessages,
    handleOpenGitOpsView,
    handleOpenSettingsPanel: () => dispatch({ type: 'set-settings-panel-open', open: true }),
    handleOpenWorktreeDiffFile,
    handleDirectorySelect: (directoryId: string) =>
      dispatch({
        type: getDirectorySelectionAction(workspaceState.activeView),
        directoryId,
        workspaceId: findWorkspaceForDirectory(navigation, directories, directoryId)?.id,
      }),
    handleSetSelectedDirectory: (directoryId: string) =>
      dispatch({ type: 'set-selected-directory', directoryId }),
    handleSelectInboxChat,
    handleShowView,
    handleShowWorkspace,
    handleShowLanding,
    handleChatOpen,
    handleChatCycle,
    handleToggleDirectoryCollapse,
    handleToggleTerminal,
    handleCloseTerminalDrawer,
    handleCloseSettingsPanel: () => dispatch({ type: 'set-settings-panel-open', open: false }),
  }
}
