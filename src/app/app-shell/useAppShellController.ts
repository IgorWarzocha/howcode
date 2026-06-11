import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useDesktopBridge } from '../hooks/useDesktopBridge'
import { useDesktopInbox } from '../hooks/useDesktopInbox'
import { useDesktopShell } from '../hooks/useDesktopShell'
import { useToast } from '../hooks/useToast'
import { deriveControllerViewModel } from './controller-view-model'
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

export function useAppShellController() {
  const queryClient = useQueryClient()
  const bundle = useAppShellStateBundle()
  const chatSidebar = useAppShellChatSidebar(bundle.state.activeView)
  const { toast, showToast } = useToast()
  const desktopShell = useDesktopShell()
  const invokeDesktopAction = useDesktopBridge()
  const projects = desktopShell.shellState?.projects ?? []
  useAppShellUrlSync({ dispatch: bundle.dispatch, projects, state: bundle.state })
  const selectedThread = useSelectedThreadData({
    liveThreadData: bundle.liveThreadData,
    selectedSessionPath: bundle.state.selectedSessionPath,
    threadHistoryCompactions: bundle.threadHistoryCompactions,
    threadQueryDeferred: bundle.threadQueryDeferred,
    threadRefreshKey: bundle.threadRefreshKey,
  })
  const inboxQuery = useDesktopInbox()
  const inboxThreads = inboxQuery.data ?? []
  const selectedInboxThread = useMemo(
    () =>
      inboxThreads.find((thread) => thread.sessionPath === bundle.state.selectedInboxSessionPath) ??
      null,
    [inboxThreads, bundle.state.selectedInboxSessionPath],
  )
  const terminals = useRunningTerminalSessions()
  const viewModel = useMemo(
    () =>
      deriveControllerViewModel({
        projects,
        workspaceState: bundle.state,
        threadData: selectedThread.effectiveThreadData,
        shellCwd: desktopShell.shellState?.cwd,
        composerState: bundle.composerState,
        shellComposerState: desktopShell.shellState?.composer,
      }),
    [
      bundle.composerState,
      bundle.state,
      desktopShell.shellState,
      projects,
      selectedThread.effectiveThreadData,
    ],
  )
  useAppShellEffects({
    projects,
    collapsedProjectIds: viewModel.collapsedProjectIds,
    workspaceState: bundle.state,
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
    dispatch: bundle.dispatch,
    setArchivedThreads: bundle.setArchivedThreads,
    setComposerState: bundle.setComposerState,
    setChatSidebarState: chatSidebar.setChatSidebarState,
    setLiveThreadData: bundle.setLiveThreadData,
    setProjectGitState: bundle.setProjectGitState,
    setProjectGitLoading: bundle.setProjectGitLoading,
    setThreadHistoryCompactions: bundle.setThreadHistoryCompactions,
  })
  const actions = useDesktopActionHandlers({
    activeView: bundle.state.activeView,
    composerProjectId: viewModel.composerProjectId,
    dispatch: bundle.dispatch,
    invokeDesktopAction,
    loadArchivedThreads: desktopShell.loadArchivedThreads,
    loadComposerState: desktopShell.loadComposerState,
    loadProjectGitState: desktopShell.loadProjectGitState,
    loadProjectThreads: desktopShell.loadProjectThreads,
    refreshShellState: desktopShell.refreshShellState,
    selectedSessionPath: bundle.state.selectedSessionPath,
    shellState: desktopShell.shellState,
    setArchivedThreads: bundle.setArchivedThreads,
    setChatSidebarState: chatSidebar.setChatSidebarState,
    setComposerState: bundle.setComposerState,
    setLiveThreadData: bundle.setLiveThreadData,
    setProjectGitState: bundle.setProjectGitState,
    showToast,
    workspaceState: bundle.state,
  })
  useProjectRepoOriginRefresh({
    projects,
    selectedProjectId: bundle.state.selectedProjectId,
    runDesktopAction: actions.runDesktopAction,
  })
  useScopedProjectViewSync({
    activeView: bundle.state.activeView,
    extensionsProjectScopeActive: bundle.extensionsProjectScopeActive,
    setExtensionsProjectScopeActive: bundle.setExtensionsProjectScopeActive,
    setSkillsProjectScopeActive: bundle.setSkillsProjectScopeActive,
    skillsProjectScopeActive: bundle.skillsProjectScopeActive,
  })
  useInboxAutoReadSync({
    dispatch: bundle.dispatch,
    inboxQueryIsSuccess: inboxQuery.isSuccess,
    inboxThreads,
    invokeDesktopAction,
    loadProjectThreads: desktopShell.loadProjectThreads,
    queryClient,
    workspaceState: bundle.state,
  })
  const commands = useAppShellCommands({
    collapsedProjectIds: viewModel.collapsedProjectIds,
    composerProjectId: viewModel.composerProjectId,
    dispatch: bundle.dispatch,
    handleAction: actions.handleAction,
    queryClient,
    setSettingsOpenTarget: bundle.setSettingsOpenTarget,
    setThreadHistoryCompactions: bundle.setThreadHistoryCompactions,
    setThreadRefreshKey: bundle.setThreadRefreshKey,
    setThreadQueryDeferred: bundle.setThreadQueryDeferred,
    shellState: desktopShell.shellState,
    workspaceState: bundle.state,
  })

  return {
    ...viewModel,
    activeThreadLoading: selectedThread.activeThreadLoading,
    archivedThreads: bundle.archivedThreads,
    handleAction: actions.handleAction,
    ...commands,
    inboxThreads,
    inboxLoading: inboxQuery.isLoading,
    handleSetSkillsProjectScopeActive: bundle.setSkillsProjectScopeActive,
    handleSetExtensionsProjectScopeActive: bundle.setExtensionsProjectScopeActive,
    handleLoadProjectThreads: desktopShell.loadProjectThreads,
    listComposerAttachmentEntries: desktopShell.listComposerAttachmentEntries,
    pickComposerAttachments: desktopShell.pickComposerAttachments,
    extensionsProjectScopeActive: bundle.extensionsProjectScopeActive,
    appLaunchedAtMs: bundle.appLaunchedAtMs,
    projects,
    projectGitState: bundle.projectGitState,
    projectGitLoading: bundle.projectGitLoading,
    shellState: desktopShell.shellState,
    shellLoading: desktopShell.shellLoading,
    settingsOpenTarget: bundle.settingsOpenTarget,
    skillsProjectScopeActive: bundle.skillsProjectScopeActive,
    state: bundle.state,
    selectedInboxThread,
    terminalRunningWorkspaceIds: terminals.terminalRunningWorkspaceIds,
    terminalRunningSessionPaths: terminals.terminalRunningSessionPaths,
    toast,
    chatSidebarState: chatSidebar.chatSidebarState,
    chatSidebarLoading: chatSidebar.chatSidebarLoading,
    selectedChatGroupId: chatSidebar.selectedChatGroupId,
    handleCreateChatGroup: chatSidebar.handleCreateChatGroup,
    handleSelectChatGroup: chatSidebar.setSelectedChatGroupId,
    refreshChatSidebarState: chatSidebar.refreshChatSidebarState,
  }
}

export type AppShellController = ReturnType<typeof useAppShellController>
