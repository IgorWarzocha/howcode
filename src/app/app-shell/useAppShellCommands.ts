import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { isLocalConversationId } from '@howcode/shared/conversation-ids'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'
import type { DesktopActionResult, InboxThread } from '../desktop/types'
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
    | 'inbox.mark-read'
    | 'inbox.dismiss',
  payload?: Record<string, unknown>,
) => Promise<DesktopActionResult | null>

type UseAppShellCommandsInput = {
  collapsedProjectIds: Record<string, boolean>
  composerProjectId: string
  dispatch: Dispatch<WorkspaceAction>
  handleAction: HandleAction
  queryClient: QueryClient
  setThreadHistoryCompactions: Dispatch<SetStateAction<number>>
  setThreadQueryDeferred: Dispatch<SetStateAction<boolean>>
  setSettingsOpenTarget: Dispatch<SetStateAction<SettingsOpenTarget | null>>
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
  setThreadQueryDeferred,
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
    const selectedConversationId = workspaceState.selectedConversationId
    const selectedProjectId = workspaceState.selectedProjectId
    if (!(selectedProjectId && isLocalConversationId(selectedConversationId))) return

    const localConversationId = selectedConversationId ?? ''
    forgetLocalDraftThread(selectedProjectId, localConversationId)
    removeProjectThreadFromShellState(queryClient, selectedProjectId, localConversationId)
  }

  const handleThreadOpen = (
    projectId: string,
    threadId: string,
    conversationId: string,
    view?: 'chat' | 'thread' | undefined,
    branchName?: string | null | undefined,
  ) => {
    clearSelectedUnstartedDraft()
    setThreadHistoryCompactions(0)
    dispatch({ type: 'open-thread', projectId, threadId, conversationId, view })
    scheduleThreadOpenAction({ projectId, threadId, conversationId, view, branchName })
  }

  const handleThreadCycle = (
    projectId: string,
    threadId: string,
    conversationId: string,
    view?: 'chat' | 'thread' | undefined,
  ) => {
    setThreadHistoryCompactions(0)
    dispatch({ type: 'preview-thread', projectId, threadId, view })
    scheduleThreadOpenAction({
      projectId,
      threadId,
      conversationId,
      view,
      delayMs: THREAD_CYCLE_OPEN_ACTION_DELAY_MS,
      deferThreadQuery: true,
      commitLocally: true,
    })
  }

  const handleSelectInboxThread = (thread: InboxThread) => {
    dispatch({ type: 'select-inbox-thread', conversationId: thread.conversationId })

    if (thread.unread) {
      void handleAction('inbox.mark-read', {
        projectId: thread.projectId,
        conversationId: thread.conversationId,
      })
    }
  }

  const handleDismissInboxThread = (thread: InboxThread) => {
    void handleAction('inbox.dismiss', {
      projectId: thread.projectId,
      conversationId: thread.conversationId,
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

  return {
    handleCloseGitOpsView,
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
    handleSelectInboxThread,
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
