import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { getPersistedSessionPath } from '../../../shared/session-paths'
import type { ArchivedThread, ComposerState, ProjectGitState, ThreadData } from '../desktop/types'
import { useDesktopBridge } from '../hooks/useDesktopBridge'
import { useDesktopInbox } from '../hooks/useDesktopInbox'
import { useDesktopShell } from '../hooks/useDesktopShell'
import { useDesktopThreadQuery } from '../hooks/useDesktopThread'
import { useToast } from '../hooks/useToast'
import { createChatGroupQuery, getChatSidebarStateQuery } from '../query/desktop-query'
import { createInitialWorkspaceState, workspaceReducer } from '../state/workspace'
import { deriveControllerViewModel } from './controller-view-model'
import { useAppShellCommands } from './useAppShellCommands'
import { useAppShellEffects } from './useAppShellEffects'
import { useDesktopActionHandlers } from './useDesktopActionHandlers'
import { useInboxAutoReadSync } from './useInboxAutoReadSync'
import { useProjectRepoOriginRefresh } from './useProjectRepoOriginRefresh'
import { useRunningTerminalSessions } from './useRunningTerminalSessions'
import { useScopedProjectViewSync } from './useScopedProjectViewSync'

export function useAppShellController() {
  const queryClient = useQueryClient()
  const [appLaunchedAtMs] = useState(() => Date.now())
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState)
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([])
  const [composerState, setComposerState] = useState<ComposerState | null>(null)
  const [liveThreadData, setLiveThreadData] = useState<ThreadData | null>(null)
  const [projectGitState, setProjectGitState] = useState<ProjectGitState | null>(null)
  const [projectGitLoading, setProjectGitLoading] = useState(false)
  const [extensionsProjectScopeActive, setExtensionsProjectScopeActive] = useState(false)
  const [skillsProjectScopeActive, setSkillsProjectScopeActive] = useState(false)
  const [threadRefreshKey, setThreadRefreshKey] = useState(0)
  const [threadHistoryCompactions, setThreadHistoryCompactions] = useState(0)
  const [selectedChatGroupId, setSelectedChatGroupId] = useState<string | null>(null)
  const [chatSidebarState, setChatSidebarState] =
    useState<Awaited<ReturnType<typeof getChatSidebarStateQuery>>>(null)
  const [chatSidebarLoading, setChatSidebarLoading] = useState(false)
  const { toast, showToast } = useToast()
  const {
    shellState,
    shellLoading,
    loadArchivedThreads,
    loadComposerState,
    listComposerAttachmentEntries,
    loadProjectGitState,
    loadProjectThreads,
    applyProjectOrder,
    pickComposerAttachments,
    refreshShellState,
    scheduleShellStateRefresh,
  } = useDesktopShell()
  const invokeDesktopAction = useDesktopBridge()
  const projects = shellState?.projects ?? []
  const threadQuery = useDesktopThreadQuery(
    state.selectedSessionPath,
    threadRefreshKey,
    threadHistoryCompactions,
  )
  const threadData = threadQuery.data ?? null
  const selectedPersistedSessionPath = getPersistedSessionPath(state.selectedSessionPath)
  const threadDataMatchesSelection = threadData?.sessionPath === selectedPersistedSessionPath
  const activeThreadLoading = Boolean(
    selectedPersistedSessionPath &&
      (threadQuery.isLoading || threadQuery.isFetching) &&
      !(liveThreadData?.sessionPath === selectedPersistedSessionPath || threadDataMatchesSelection),
  )
  const effectiveThreadData =
    threadHistoryCompactions === 0 && liveThreadData?.sessionPath === state.selectedSessionPath
      ? liveThreadData
      : threadDataMatchesSelection
        ? threadData
        : null
  const inboxQuery = useDesktopInbox()
  const inboxThreads = inboxQuery.data ?? []
  const selectedInboxThread = useMemo(
    () =>
      inboxThreads.find((thread) => thread.sessionPath === state.selectedInboxSessionPath) ?? null,
    [inboxThreads, state.selectedInboxSessionPath],
  )
  const { terminalRunningProjectIds, terminalRunningSessionPaths } = useRunningTerminalSessions()
  const refreshChatSidebarState = useCallback(
    async (groupId = selectedChatGroupId) => {
      const nextState = await getChatSidebarStateQuery(groupId)
      setChatSidebarState(nextState)
      return nextState
    },
    [selectedChatGroupId],
  )
  const handleCreateChatGroup = async (name: string) => {
    const nextState = await createChatGroupQuery(name)
    setChatSidebarState(nextState)
    if (nextState?.selectedGroupId) setSelectedChatGroupId(nextState.selectedGroupId)
    return nextState
  }

  useEffect(() => {
    if (state.activeView === 'chat') {
      let cancelled = false
      setChatSidebarLoading(true)

      void getChatSidebarStateQuery(selectedChatGroupId)
        .then((nextState) => {
          if (!cancelled) {
            setChatSidebarState(nextState)
          }
        })
        .finally(() => {
          if (!cancelled) {
            setChatSidebarLoading(false)
          }
        })

      return () => {
        cancelled = true
      }
    }
  }, [state.activeView, selectedChatGroupId])

  const {
    activeComposerState,
    activeThreadData,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    currentTitle,
  } = useMemo(
    () =>
      deriveControllerViewModel({
        projects,
        workspaceState: state,
        threadData: effectiveThreadData,
        shellCwd: shellState?.cwd,
        composerState,
        shellComposerState: shellState?.composer,
      }),
    [composerState, effectiveThreadData, projects, shellState?.composer, shellState?.cwd, state],
  )

  useAppShellEffects({
    projects,
    collapsedProjectIds,
    workspaceState: state,
    selectedInboxThread,
    composerProjectId,
    shellComposerState: shellState?.composer,
    shellAppSettings: shellState?.appSettings,
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
  })

  const { handleAction, runDesktopAction } = useDesktopActionHandlers({
    activeView: state.activeView,
    composerProjectId,
    dispatch,
    invokeDesktopAction,
    loadArchivedThreads,
    loadComposerState,
    loadProjectGitState,
    loadProjectThreads,
    refreshShellState,
    selectedSessionPath: state.selectedSessionPath,
    setArchivedThreads,
    setChatSidebarState,
    setComposerState,
    setLiveThreadData,
    setProjectGitState,
    showToast,
    workspaceState: state,
  })

  useProjectRepoOriginRefresh({
    projects,
    selectedProjectId: state.selectedProjectId,
    runDesktopAction,
  })

  useScopedProjectViewSync({
    activeView: state.activeView,
    extensionsProjectScopeActive,
    setExtensionsProjectScopeActive,
    setSkillsProjectScopeActive,
    skillsProjectScopeActive,
  })

  useInboxAutoReadSync({
    dispatch,
    inboxQueryIsSuccess: inboxQuery.isSuccess,
    inboxThreads,
    invokeDesktopAction,
    loadProjectThreads,
    queryClient,
    workspaceState: state,
  })

  const commands = useAppShellCommands({
    applyProjectOrder,
    collapsedProjectIds,
    composerProjectId,
    dispatch,
    handleAction,
    queryClient,
    runDesktopAction,
    scheduleShellStateRefresh,
    setThreadHistoryCompactions,
    setThreadRefreshKey,
    shellState,
    workspaceState: state,
  })

  return {
    activeComposerState,
    activeThreadData,
    activeThreadLoading,
    archivedThreads,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    currentTitle,
    handleAction,
    ...commands,
    inboxThreads,
    inboxLoading: inboxQuery.isLoading,
    handleSetSkillsProjectScopeActive: setSkillsProjectScopeActive,
    handleSetExtensionsProjectScopeActive: setExtensionsProjectScopeActive,
    handleLoadProjectThreads: loadProjectThreads,
    listComposerAttachmentEntries,
    pickComposerAttachments,
    extensionsProjectScopeActive,
    appLaunchedAtMs,
    projects,
    projectGitState,
    projectGitLoading,
    shellState,
    shellLoading,
    skillsProjectScopeActive,
    state,
    selectedInboxThread,
    terminalRunningProjectIds,
    terminalRunningSessionPaths,
    toast,
    chatSidebarState,
    chatSidebarLoading,
    selectedChatGroupId,
    handleCreateChatGroup,
    handleSelectChatGroup: setSelectedChatGroupId,
    refreshChatSidebarState,
  }
}

export type AppShellController = ReturnType<typeof useAppShellController>
