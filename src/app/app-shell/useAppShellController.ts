import { useDirectoryRepoOriginRefresh } from '@howcode/components/working-directories/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useDesktopBridge } from '../hooks/useDesktopBridge'
import { useDesktopInbox } from '../hooks/useDesktopInbox'
import { useDesktopShell } from '../hooks/useDesktopShell'
import { useToast } from '../hooks/useToast'
import { useSkillsDirectoryScopeSync } from '../skills-integration'
import { terminalClient } from '../terminal-client'
import { useTerminalEnabled } from '../terminal-integration'
import { useRunningTerminalSessions } from '../useRunningTerminalSessions'
import { deriveControllerViewModel } from './controller-view-model'
import { useAppShellCommands } from './useAppShellCommands'
import { useAppShellEffects } from './useAppShellEffects'
import { useAppShellStateBundle } from './useAppShellStateBundle'
import { useAppShellUrlSync } from './useAppShellUrlSync'
import { useDesktopActionHandlers } from './useDesktopActionHandlers'
import { useInboxAutoReadSync } from './useInboxAutoReadSync'
import { useSelectedChatData } from './useSelectedChatData'
import { useAppShellWorkspaceNavigation } from './useWorkspaceNavigation'

const EMPTY_LIST: [] = []

export function useAppShellController() {
  const queryClient = useQueryClient()
  const bundle = useAppShellStateBundle()
  const workspaceNavigation = useAppShellWorkspaceNavigation({
    dispatch: bundle.workspace.dispatch,
    selectedWorkspaceId: bundle.workspace.state.selectedWorkspaceId,
  })
  const { toast, showToast } = useToast()
  const desktopShell = useDesktopShell()
  const invokeDesktopAction = useDesktopBridge()
  const directories = desktopShell.shellState?.directories ?? EMPTY_LIST
  useAppShellUrlSync({
    toolkitSettings: desktopShell.shellState?.appSettings,
    dispatch: bundle.workspace.dispatch,
    directories,
    navigation: workspaceNavigation.workspaceNavigationState,
    loading:
      desktopShell.shellLoading ||
      workspaceNavigation.workspaceNavigationLoading ||
      desktopShell.shellState === null ||
      workspaceNavigation.workspaceNavigationState === null,
    state: bundle.workspace.state,
  })
  const selectedChat = useSelectedChatData({
    liveChatData: bundle.chat.liveChatData,
    selectedConversationId: bundle.workspace.state.selectedConversationId,
    chatHistoryCompactions: bundle.chat.historyCompactions,
    chatQueryDeferred: bundle.chat.queryDeferred,
    chatRefreshKey: bundle.chat.refreshKey,
  })
  const inboxQuery = useDesktopInbox()
  const inboxChats = inboxQuery.data ?? EMPTY_LIST
  const selectedInboxChat = useMemo(
    () =>
      inboxChats.find(
        (chat) => chat.conversationId === bundle.workspace.state.selectedInboxConversationId,
      ) ?? null,
    [inboxChats, bundle.workspace.state.selectedInboxConversationId],
  )
  const terminals = useRunningTerminalSessions(
    terminalClient,
    useTerminalEnabled(desktopShell.shellState?.appSettings),
  )
  const viewModel = useMemo(
    () =>
      deriveControllerViewModel({
        directories,
        workspaceState: bundle.workspace.state,
        chatData: selectedChat.effectiveChatData,
        shellCwd: desktopShell.shellState?.cwd,
        composerState: bundle.composer.state,
        shellComposerState: desktopShell.shellState?.composer,
      }),
    [
      bundle.composer.state,
      bundle.workspace.state,
      desktopShell.shellState,
      directories,
      selectedChat.effectiveChatData,
    ],
  )
  useAppShellEffects({
    directories,
    collapsedDirectoryIds: viewModel.collapsedDirectoryIds,
    workspaceState: bundle.workspace.state,
    selectedInboxChat,
    composerDirectoryId: viewModel.composerDirectoryId,
    shellComposerState: desktopShell.shellState?.composer,
    shellAppSettings: desktopShell.shellState?.appSettings,
    loadDirectoryChats: desktopShell.loadDirectoryChats,
    loadArchivedChats: desktopShell.loadArchivedChats,
    loadComposerState: desktopShell.loadComposerState,
    scheduleShellStateRefresh: desktopShell.scheduleShellStateRefresh,
    refreshWorkspaceNavigationState: workspaceNavigation.refreshWorkspaceNavigationState,
    queryClient,
    dispatch: bundle.workspace.dispatch,
    setArchivedChats: bundle.chat.setArchivedChats,
    setComposerState: bundle.composer.setState,
    setWorkspaceNavigationState: workspaceNavigation.setWorkspaceNavigationState,
    setLiveChatData: bundle.chat.setLiveChatData,
    setChatHistoryCompactions: bundle.chat.setHistoryCompactions,
  })
  const actions = useDesktopActionHandlers({
    people: desktopShell.shellState?.appSettings.people ?? [],
    activeView: bundle.workspace.state.activeView,
    composerDirectoryId: viewModel.composerDirectoryId,
    dispatch: bundle.workspace.dispatch,
    invokeDesktopAction,
    loadArchivedChats: desktopShell.loadArchivedChats,
    loadComposerState: desktopShell.loadComposerState,
    loadDirectoryGitState: desktopShell.loadDirectoryGitState,
    loadDirectoryChats: desktopShell.loadDirectoryChats,
    refreshShellState: desktopShell.refreshShellState,
    selectedConversationId: bundle.workspace.state.selectedConversationId,
    setArchivedChats: bundle.chat.setArchivedChats,
    setWorkspaceNavigationState: workspaceNavigation.setWorkspaceNavigationState,
    setComposerState: bundle.composer.setState,
    setLiveChatData: bundle.chat.setLiveChatData,
    setDirectoryGitState: bundle.directories.setGitState,
    showToast,
    workspaceState: bundle.workspace.state,
  })
  useDirectoryRepoOriginRefresh({
    enabled: desktopShell.shellState !== null,
    directories,
    selectedDirectoryId: bundle.workspace.state.selectedDirectoryId,
    runDesktopAction: actions.runDesktopAction,
  })
  useSkillsDirectoryScopeSync({
    activeView: bundle.workspace.state.activeView,
    setSkillsDirectoryScopeActive: bundle.resourceScope.setSkillsActive,
    skillsDirectoryScopeActive: bundle.resourceScope.skillsActive,
  })
  useInboxAutoReadSync({
    dispatch: bundle.workspace.dispatch,
    inboxQueryIsSuccess: inboxQuery.isSuccess,
    inboxChats,
    invokeDesktopAction,
    loadDirectoryChats: desktopShell.loadDirectoryChats,
    queryClient,
    workspaceState: bundle.workspace.state,
  })
  const commands = useAppShellCommands({
    navigation: workspaceNavigation.workspaceNavigationState,
    directories,
    toolkitSettings: desktopShell.shellState?.appSettings,
    collapsedDirectoryIds: viewModel.collapsedDirectoryIds,
    composerDirectoryId: viewModel.composerDirectoryId,
    dispatch: bundle.workspace.dispatch,
    handleAction: actions.handleAction,
    queryClient,
    setSettingsOpenTarget: bundle.settings.setOpenTarget,
    setChatHistoryCompactions: bundle.chat.setHistoryCompactions,
    setChatQueryDeferred: bundle.chat.setQueryDeferred,
    workspaceState: bundle.workspace.state,
  })

  return {
    app: { launchedAtMs: bundle.appLaunchedAtMs, toast, showToast },
    desktop: {
      handleAction: actions.handleAction,
      shellLoading: desktopShell.shellLoading,
      shellError: desktopShell.shellError,
      retryShellState: desktopShell.retryShellState,
      shellState: desktopShell.shellState,
    },
    workspace: {
      state: bundle.workspace.state,
    },
    directories: {
      collapsedIds: viewModel.collapsedDirectoryIds,
      currentName: viewModel.currentDirectoryName,
      gitLoading: bundle.directories.gitLoading,
      gitState: bundle.directories.gitState,
      items: directories,
      loadChats: desktopShell.loadDirectoryChats,
      primeSelection: commands.handleSetSelectedDirectory,
      select: commands.handleDirectorySelect,
      toggleCollapse: commands.handleToggleDirectoryCollapse,
    },
    chat: {
      activeData: viewModel.activeChatData,
      activeLoading: selectedChat.activeChatLoading,
      archived: bundle.chat.archivedChats,
      cycle: commands.handleChatCycle,
      loadEarlierMessages: commands.handleLoadEarlierMessages,
      open: commands.handleChatOpen,
    },
    composer: {
      listAttachmentEntries: desktopShell.listComposerAttachmentEntries,
      directoryId: viewModel.composerDirectoryId,
      state: viewModel.activeComposerState,
    },
    inbox: {
      dismiss: commands.handleDismissInboxChat,
      loading: inboxQuery.isLoading,
      select: commands.handleSelectInboxChat,
      selectedChat: selectedInboxChat,
      chats: inboxChats,
    },
    workspaces: {
      create: workspaceNavigation.handleCreateWorkspace,
      error: workspaceNavigation.workspaceNavigationError,
      loading: workspaceNavigation.workspaceNavigationLoading,
      retry: workspaceNavigation.retryWorkspaceNavigationState,
      refresh: workspaceNavigation.refreshWorkspaceNavigationState,
      select: workspaceNavigation.setSelectedWorkspaceId,
      selectedWorkspaceId: workspaceNavigation.selectedWorkspaceId,
      state: workspaceNavigation.workspaceNavigationState,
    },
    terminal: {
      closeDrawer: commands.handleCloseTerminalDrawer,
      runningConversationIds: terminals.terminalRunningConversationIds,
      runningWorkspaceIds: terminals.terminalRunningWorkspaceIds,
      toggle: commands.handleToggleTerminal,
    },
    gitOps: {
      close: commands.handleCloseGitOpsView,
      open: commands.handleOpenGitOpsView,
      openWorktreeFile: commands.handleOpenWorktreeDiffFile,
    },
    navigation: {
      closeUtilityView: commands.handleCloseUtilityView,
      showLanding: commands.handleShowLanding,
      showView: commands.handleShowView,
      showWorkspace: commands.handleShowWorkspace,
    },
    resourceScope: {
      setSkillsActive: bundle.resourceScope.setSkillsActive,
      skillsActive: bundle.resourceScope.skillsActive,
    },
    settings: { openTarget: bundle.settings.openTarget },
  }
}

export type AppShellController = ReturnType<typeof useAppShellController>
