import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useDesktopBridge } from '../hooks/useDesktopBridge'
import { useDesktopInbox } from '../hooks/useDesktopInbox'
import { useDesktopShell } from '../hooks/useDesktopShell'
import { useToast } from '../hooks/useToast'
import { deriveControllerViewModel } from './controller-view-model'
import { getVisibleDesktopSessionPath } from './desktop-event-sync'
import { useAppShellChatSidebar } from './useAppShellChatSidebar'
import { useAppShellCommands } from './useAppShellCommands'
import { useAppShellEffects } from './useAppShellEffects'
import { useAppShellStateBundle } from './useAppShellStateBundle'
import { useAppShellUrlSync } from './useAppShellUrlSync'
import { useDesktopActionHandlers } from './useDesktopActionHandlers'
import { useInboxAutoReadSync } from './useInboxAutoReadSync'
import { useProjectRepoOriginRefresh } from './useProjectRepoOriginRefresh'
import { useRunningTerminalSessions } from './useRunningTerminalSessions'
import { useScopedProjectViewSync } from './useScopedProjectViewSync'
import { useSelectedThreadData } from './useSelectedThreadData'

const EMPTY_LIST: [] = []

export function useAppShellController() {
  const queryClient = useQueryClient()
  const bundle = useAppShellStateBundle()
  const chatSidebar = useAppShellChatSidebar(bundle.workspace.state.activeView)
  const { toast, showToast } = useToast()
  const desktopShell = useDesktopShell()
  const invokeDesktopAction = useDesktopBridge()
  const projects = desktopShell.shellState?.projects ?? EMPTY_LIST
  useAppShellUrlSync({
    dispatch: bundle.workspace.dispatch,
    projects,
    state: bundle.workspace.state,
  })
  const selectedThread = useSelectedThreadData({
    liveThreadData: bundle.thread.liveThreadData,
    selectedSessionPath: bundle.workspace.state.selectedSessionPath,
    threadHistoryCompactions: bundle.thread.historyCompactions,
    threadQueryDeferred: bundle.thread.queryDeferred,
    threadRefreshKey: bundle.thread.refreshKey,
  })
  const inboxQuery = useDesktopInbox()
  const inboxThreads = inboxQuery.data ?? EMPTY_LIST
  const selectedInboxThread = useMemo(
    () =>
      inboxThreads.find(
        (thread) => thread.sessionPath === bundle.workspace.state.selectedInboxSessionPath,
      ) ?? null,
    [inboxThreads, bundle.workspace.state.selectedInboxSessionPath],
  )
  const terminals = useRunningTerminalSessions()
  const visibleExtensionUiSessionPath = getVisibleDesktopSessionPath(bundle.workspace.state)
  const activePiExtensionUiState = visibleExtensionUiSessionPath
    ? (bundle.composer.extensionUiBySession[visibleExtensionUiSessionPath] ?? null)
    : null
  const viewModel = useMemo(
    () =>
      deriveControllerViewModel({
        projects,
        workspaceState: bundle.workspace.state,
        threadData: selectedThread.effectiveThreadData,
        shellCwd: desktopShell.shellState?.cwd,
        composerState: bundle.composer.state,
        shellComposerState: desktopShell.shellState?.composer,
      }),
    [
      bundle.composer.state,
      bundle.workspace.state,
      desktopShell.shellState,
      projects,
      selectedThread.effectiveThreadData,
    ],
  )
  useAppShellEffects({
    projects,
    collapsedProjectIds: viewModel.collapsedProjectIds,
    workspaceState: bundle.workspace.state,
    selectedInboxThread,
    composerProjectId: viewModel.composerProjectId,
    shellComposerState: desktopShell.shellState?.composer,
    shellAppSettings: desktopShell.shellState?.appSettings,
    loadProjectThreads: desktopShell.loadProjectThreads,
    loadArchivedThreads: desktopShell.loadArchivedThreads,
    loadComposerState: desktopShell.loadComposerState,
    loadProjectGitState: desktopShell.loadProjectGitState,
    scheduleShellStateRefresh: desktopShell.scheduleShellStateRefresh,
    refreshChatSidebarState: chatSidebar.refreshChatSidebarState,
    queryClient,
    dispatch: bundle.workspace.dispatch,
    setArchivedThreads: bundle.thread.setArchivedThreads,
    setComposerState: bundle.composer.setState,
    setChatSidebarState: chatSidebar.setChatSidebarState,
    setLiveThreadData: bundle.thread.setLiveThreadData,
    setPiExtensionUiStateBySession: bundle.composer.setExtensionUiBySession,
    setProjectGitState: bundle.projects.setGitState,
    setProjectGitLoading: bundle.projects.setGitLoading,
    setThreadHistoryCompactions: bundle.thread.setHistoryCompactions,
  })
  const actions = useDesktopActionHandlers({
    activeView: bundle.workspace.state.activeView,
    composerProjectId: viewModel.composerProjectId,
    dispatch: bundle.workspace.dispatch,
    invokeDesktopAction,
    loadArchivedThreads: desktopShell.loadArchivedThreads,
    loadComposerState: desktopShell.loadComposerState,
    loadProjectGitState: desktopShell.loadProjectGitState,
    loadProjectThreads: desktopShell.loadProjectThreads,
    refreshShellState: desktopShell.refreshShellState,
    selectedSessionPath: bundle.workspace.state.selectedSessionPath,
    shellState: desktopShell.shellState,
    setArchivedThreads: bundle.thread.setArchivedThreads,
    setChatSidebarState: chatSidebar.setChatSidebarState,
    setComposerState: bundle.composer.setState,
    setLiveThreadData: bundle.thread.setLiveThreadData,
    setProjectGitState: bundle.projects.setGitState,
    showToast,
    workspaceState: bundle.workspace.state,
  })
  useProjectRepoOriginRefresh({
    projects,
    selectedProjectId: bundle.workspace.state.selectedProjectId,
    runDesktopAction: actions.runDesktopAction,
  })
  useScopedProjectViewSync({
    activeView: bundle.workspace.state.activeView,
    extensionsProjectScopeActive: bundle.resourceScope.extensionsActive,
    setExtensionsProjectScopeActive: bundle.resourceScope.setExtensionsActive,
    setSkillsProjectScopeActive: bundle.resourceScope.setSkillsActive,
    skillsProjectScopeActive: bundle.resourceScope.skillsActive,
  })
  useInboxAutoReadSync({
    dispatch: bundle.workspace.dispatch,
    inboxQueryIsSuccess: inboxQuery.isSuccess,
    inboxThreads,
    invokeDesktopAction,
    loadProjectThreads: desktopShell.loadProjectThreads,
    queryClient,
    workspaceState: bundle.workspace.state,
  })
  const commands = useAppShellCommands({
    collapsedProjectIds: viewModel.collapsedProjectIds,
    composerProjectId: viewModel.composerProjectId,
    dispatch: bundle.workspace.dispatch,
    handleAction: actions.handleAction,
    queryClient,
    setSettingsOpenTarget: bundle.settings.setOpenTarget,
    setThreadHistoryCompactions: bundle.thread.setHistoryCompactions,
    setThreadRefreshKey: bundle.thread.setRefreshKey,
    setThreadQueryDeferred: bundle.thread.setQueryDeferred,
    shellState: desktopShell.shellState,
    workspaceState: bundle.workspace.state,
  })

  return {
    app: { launchedAtMs: bundle.appLaunchedAtMs, toast },
    desktop: {
      handleAction: actions.handleAction,
      shellLoading: desktopShell.shellLoading,
      shellState: desktopShell.shellState,
    },
    workspace: {
      state: bundle.workspace.state,
    },
    projects: {
      collapsedIds: viewModel.collapsedProjectIds,
      currentName: viewModel.currentProjectName,
      gitLoading: bundle.projects.gitLoading,
      gitState: bundle.projects.gitState,
      items: projects,
      loadThreads: desktopShell.loadProjectThreads,
      primeSelection: commands.handleSetSelectedProject,
      select: commands.handleProjectSelect,
      toggleCollapse: commands.handleToggleProjectCollapse,
    },
    thread: {
      activeData: viewModel.activeThreadData,
      activeLoading: selectedThread.activeThreadLoading,
      archived: bundle.thread.archivedThreads,
      cycle: commands.handleThreadCycle,
      loadEarlierMessages: commands.handleLoadEarlierMessages,
      open: commands.handleThreadOpen,
    },
    composer: {
      extensionUiState: activePiExtensionUiState,
      listAttachmentEntries: desktopShell.listComposerAttachmentEntries,
      projectId: viewModel.composerProjectId,
      state: viewModel.activeComposerState,
    },
    inbox: {
      dismiss: commands.handleDismissInboxThread,
      loading: inboxQuery.isLoading,
      select: commands.handleSelectInboxThread,
      selectedThread: selectedInboxThread,
      threads: inboxThreads,
    },
    chat: {
      createGroup: chatSidebar.handleCreateChatGroup,
      loading: chatSidebar.chatSidebarLoading,
      refresh: chatSidebar.refreshChatSidebarState,
      selectGroup: chatSidebar.setSelectedChatGroupId,
      selectedGroupId: chatSidebar.selectedChatGroupId,
      state: chatSidebar.chatSidebarState,
    },
    terminal: {
      closeDrawer: commands.handleCloseTerminalDrawer,
      runningSessionPaths: terminals.terminalRunningSessionPaths,
      runningWorkspaceIds: terminals.terminalRunningWorkspaceIds,
      toggle: commands.handleToggleTerminal,
    },
    gitOps: {
      close: commands.handleCloseGitOpsView,
      open: commands.handleOpenGitOpsView,
      openWorktreeFile: commands.handleOpenWorktreeDiffFile,
    },
    takeover: {
      close: commands.handleCloseTakeoverTerminal,
      returnToDesktop: commands.handleReturnToDesktopFromTakeover,
      show: commands.handleShowTakeoverTerminal,
    },
    navigation: {
      closeUtilityView: commands.handleCloseUtilityView,
      showLanding: commands.handleShowLanding,
      showView: commands.handleShowView,
      toggleSettings: commands.handleToggleSettings,
    },
    resourceScope: {
      extensionsActive: bundle.resourceScope.extensionsActive,
      setExtensionsActive: bundle.resourceScope.setExtensionsActive,
      setSkillsActive: bundle.resourceScope.setSkillsActive,
      skillsActive: bundle.resourceScope.skillsActive,
    },
    settings: { openTarget: bundle.settings.openTarget },
  }
}

export type AppShellController = ReturnType<typeof useAppShellController>
