import { useCodingWorkspaceCommands } from '@howcode/components/coding/ui'
import { useTerminalCommands } from '@howcode/components/terminal/ui'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { isLocalConversationId } from '@howcode/shared/conversation-ids'
import {
  isToolkitComponentEnabled,
  type ToolkitComponentSettings,
} from '@howcode/shared/toolkit-components'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { isWorkspaceViewEnabled } from '../component-system/toolkit-components'
import type { DesktopActionResult, InboxThread } from '../desktop/types'
import { forgetLocalDraftThread } from '../hooks/useDesktopProjectThreads'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
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
  toolkitSettings: ToolkitComponentSettings | undefined
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

export function useAppShellCommands({
  toolkitSettings,
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

  const { handleToggleTerminal, handleCloseTerminalDrawer } = useTerminalCommands({
    dispatch,
    toolkitSettings,
  })
  const { handleOpenGitOpsView, handleCloseGitOpsView, handleOpenWorktreeDiffFile } =
    useCodingWorkspaceCommands({ composerProjectId, dispatch, queryClient })

  const handleShowView = (view: Exclude<View, 'gitops'>, target?: SettingsOpenTarget) => {
    const enabledView = isWorkspaceViewEnabled(toolkitSettings, view) ? view : 'chat'
    if (enabledView === 'settings') {
      setSettingsOpenTarget(target ?? null)
    }
    dispatch({ type: 'show-view', view: enabledView })
  }

  const handleShowLanding = () => {
    dispatch(
      isToolkitComponentEnabled(toolkitSettings, 'coding')
        ? { type: 'show-landing' }
        : { type: 'show-view', view: 'chat' },
    )
  }

  const handleCloseUtilityView = () => {
    dispatch({ type: 'close-utility-view' })
  }

  const handleShowWorkspace = () => {
    dispatch({ type: 'show-view', view: 'chat' })
    dispatch({ type: 'clear-thread-selection' })
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
    handleShowWorkspace,
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
