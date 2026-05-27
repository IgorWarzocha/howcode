import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { isLocalSessionPath } from '@howcode/shared/session-paths'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'
import type { DesktopActionResult, InboxThread, ShellState } from '../desktop/types'
import { notifyProjectDiffInvalidated } from '../hooks/project-diff-invalidation'
import { forgetLocalDraftThread } from '../hooks/useDesktopProjectThreads'
import { desktopQueryKeys } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import type { View } from '../types'
import { removeProjectThreadFromShellState } from './project-thread-cache'
import { getProjectSelectionAction } from './scoped-project-view'
import { THREAD_CYCLE_OPEN_ACTION_DELAY_MS, useScheduledThreadOpen } from './useScheduledThreadOpen'

type HandleAction = (
  action:
    | 'threads.collapse-all'
    | 'project.collapse'
    | 'project.expand'
    | 'thread.open'
    | 'thread.new'
    | 'inbox.mark-read'
    | 'inbox.dismiss'
    | 'composer.reload-settings',
  payload?: Record<string, unknown>,
) => Promise<DesktopActionResult | null>

type UseAppShellCommandsInput = {
  collapsedProjectIds: Record<string, boolean>
  composerProjectId: string
  dispatch: Dispatch<WorkspaceAction>
  handleAction: HandleAction
  queryClient: QueryClient
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>
  setThreadRefreshKey: Dispatch<SetStateAction<number>>
  setThreadQueryDeferred: Dispatch<SetStateAction<boolean>>
  setSettingsOpenTarget: Dispatch<SetStateAction<SettingsOpenTarget | null>>
  shellState: ShellState | null
  workspaceState: WorkspaceState
}

function resetProjectDiffCaches(queryClient: QueryClient, projectId: string) {
  notifyProjectDiffInvalidated(projectId)
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
  })
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffImagePreviewPrefix(projectId),
  })
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
  })
}

export function useAppShellCommands({
  collapsedProjectIds,
  composerProjectId,
  dispatch,
  handleAction,
  queryClient,
  setSettingsOpenTarget,
  setThreadHistoryCompactions,
  setThreadRefreshKey,
  setThreadQueryDeferred,
  shellState,
  workspaceState,
}: UseAppShellCommandsInput) {
  const scheduleThreadOpenAction = useScheduledThreadOpen({
    dispatch,
    handleAction,
    setThreadQueryDeferred,
    workspaceState,
  })

  const handleToggleTerminal = useCallback(() => dispatch({ type: 'toggle-terminal' }), [dispatch])
  const handleCloseTerminalDrawer = useCallback(
    () => dispatch({ type: 'set-terminal-visible', visible: false }),
    [dispatch],
  )

  const handleShowView = (view: Exclude<View, 'gitops'>, target?: SettingsOpenTarget) => {
    if (view === 'settings') {
      setSettingsOpenTarget(target ?? null)
    }
    dispatch({ type: 'show-view', view })
  }

  const handleShowLanding = () => {
    dispatch({ type: 'show-landing' })
  }

  const handleCloseUtilityView = () => {
    dispatch({ type: 'close-utility-view' })
  }

  const handleCollapseAll = () => {
    dispatch({ type: 'collapse-all-projects' })
    void handleAction('threads.collapse-all')
  }

  const handleToggleProjectCollapse = (projectId: string) => {
    const nextCollapsed = !collapsedProjectIds[projectId]
    dispatch({ type: 'toggle-project-collapse', projectId })
    void handleAction(nextCollapsed ? 'project.collapse' : 'project.expand', { projectId })
  }

  const clearSelectedUnstartedDraft = () => {
    const selectedSessionPath = workspaceState.selectedSessionPath
    const selectedProjectId = workspaceState.selectedProjectId
    if (
      workspaceState.takeoverVisible ||
      !(selectedProjectId && isLocalSessionPath(selectedSessionPath))
    )
      return

    const localSessionPath = selectedSessionPath ?? ''
    forgetLocalDraftThread(selectedProjectId, localSessionPath)
    removeProjectThreadFromShellState(queryClient, selectedProjectId, localSessionPath)
  }

  const handleThreadOpen = (
    projectId: string,
    threadId: string,
    sessionPath: string,
    view?: 'chat' | 'thread' | undefined,
  ) => {
    clearSelectedUnstartedDraft()
    setThreadHistoryCompactions(0)
    dispatch({ type: 'open-thread', projectId, threadId, sessionPath, view })
    scheduleThreadOpenAction({ projectId, threadId, sessionPath, view })
  }

  const handleThreadCycle = (
    projectId: string,
    threadId: string,
    sessionPath: string,
    view?: 'chat' | 'thread' | undefined,
  ) => {
    setThreadHistoryCompactions(0)
    dispatch({ type: 'preview-thread', projectId, threadId, view })
    scheduleThreadOpenAction({
      projectId,
      threadId,
      sessionPath,
      view,
      delayMs: THREAD_CYCLE_OPEN_ACTION_DELAY_MS,
      deferThreadQuery: true,
      commitLocally: true,
    })
  }

  const handleSelectInboxThread = (thread: InboxThread) => {
    dispatch({ type: 'select-inbox-thread', sessionPath: thread.sessionPath })

    if (thread.unread) {
      void handleAction('inbox.mark-read', {
        projectId: thread.projectId,
        sessionPath: thread.sessionPath,
      })
    }
  }

  const handleDismissInboxThread = (thread: InboxThread) => {
    void handleAction('inbox.dismiss', {
      projectId: thread.projectId,
      sessionPath: thread.sessionPath,
    })
  }

  const handleLoadEarlierMessages = (targetHistoryCompactions?: number | undefined) => {
    if (typeof targetHistoryCompactions === 'number' && Number.isFinite(targetHistoryCompactions)) {
      setThreadHistoryCompactions(Math.max(0, Math.floor(targetHistoryCompactions)))
      return
    }

    setThreadHistoryCompactions((current) => current + 1)
  }

  const handleOpenGitOpsView = (options: { filePath?: string | null } = {}) => {
    if (composerProjectId) {
      resetProjectDiffCaches(queryClient, composerProjectId)
    }

    dispatch({ type: 'open-gitops', filePath: options.filePath ?? null })
  }

  const handleCloseGitOpsView = () => {
    dispatch({ type: 'close-gitops' })
  }

  const handleOpenWorktreeDiffFile = (filePath: string) => {
    handleOpenGitOpsView({ filePath })
  }

  const setTakeoverOverrideForSelectedSession = (visible: boolean) => {
    const sessionPath = workspaceState.selectedSessionPath
    const globalTakeoverVisible = shellState?.appSettings?.piTuiTakeover

    if (!sessionPath || typeof globalTakeoverVisible !== 'boolean') {
      return
    }

    dispatch({
      type: 'set-session-takeover-override',
      sessionPath,
      visible: visible === globalTakeoverVisible ? null : visible,
    })
  }

  const handleShowTakeoverTerminal = async () => {
    if (
      workspaceState.activeView === 'project' &&
      composerProjectId &&
      !workspaceState.selectedSessionPath
    ) {
      await handleAction('thread.new', { projectId: composerProjectId })
    }

    dispatch({ type: 'set-takeover-visible', visible: true })
    setTakeoverOverrideForSelectedSession(true)
  }

  const closeTakeover = async ({
    preserveSessionOverride = false,
    refreshThread = true,
  }: {
    preserveSessionOverride?: boolean
    refreshThread?: boolean
  } = {}) => {
    dispatch({ type: 'set-takeover-visible', visible: false })

    if (!preserveSessionOverride) {
      setTakeoverOverrideForSelectedSession(false)
    }

    if (refreshThread) {
      setThreadRefreshKey((current) => current + 1)
    }

    if (workspaceState.selectedSessionPath) {
      await handleAction('composer.reload-settings', {
        projectId: composerProjectId,
        sessionPath: workspaceState.selectedSessionPath,
      })
    }
  }

  const handleReturnToDesktopFromTakeover = () => {
    void closeTakeover()
  }

  return {
    handleCloseGitOpsView,
    handleCloseTakeoverTerminal: closeTakeover,
    handleCloseUtilityView,
    handleCollapseAll,
    handleDismissInboxThread,
    handleLoadEarlierMessages,
    handleOpenGitOpsView,
    handleOpenSettingsPanel: () => dispatch({ type: 'set-settings-panel-open', open: true }),
    handleOpenWorktreeDiffFile,
    handleProjectSelect: (projectId: string) =>
      dispatch({ type: getProjectSelectionAction(workspaceState.activeView), projectId }),
    handleSetSelectedProject: (projectId: string) =>
      dispatch({ type: 'set-selected-project', projectId }),
    handleReturnToDesktopFromTakeover,
    handleSelectInboxThread,
    handleShowTakeoverTerminal,
    handleShowView,
    handleShowLanding,
    handleThreadOpen,
    handleThreadCycle,
    handleToggleProjectCollapse,
    handleToggleSettings: () => dispatch({ type: 'toggle-settings' }),
    handleToggleTerminal,
    handleCloseTerminalDrawer,
    handleCloseSettingsPanel: () => dispatch({ type: 'set-settings-panel-open', open: false }),
  }
}
