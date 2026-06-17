import { useQueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'
import type { DesktopAction } from '../desktop/actions'
import { cleanUserErrorMessage } from '../desktop/error-messages'
import type {
  AnyDesktopActionPayload,
  ArchivedThread,
  ChatSidebarState,
  ComposerState,
  DesktopActionInvoker,
  DesktopActionResult,
  ProjectGitState,
  ShellState,
  ThreadData,
} from '../desktop/types'
import { checkAppUpdateQuery } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import type { View } from '../types'
import { guardBranchResume } from './branch-resume-guard'
import { buildContextualActionPayload } from './controller-action-helpers'
import {
  applyOptimisticPinUpdate,
  applyOptimisticPiSettingsUpdate,
  applyOptimisticProjectRename,
  applyOptimisticSettingsUpdate,
  applyOptimisticThreadRename,
  runPostDesktopActionEffects,
} from './controller-post-action-effects'
import { applySwitchBranchPostEffect } from './post-effects/workspace'
import {
  applyOptimisticComposerThread,
  removeFailedOptimisticComposerThread,
} from './sidebar-thread-sync'

type ActionPayload = AnyDesktopActionPayload

type UseDesktopActionHandlersArgs = {
  activeView: View
  composerProjectId: string
  dispatch: Dispatch<WorkspaceAction>
  invokeDesktopAction: DesktopActionInvoker
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  loadComposerState: (request?: {
    projectId?: string | null
    sessionPath?: string | null
    composerMode?: 'chat' | 'code' | null
  }) => Promise<ComposerState | null>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean; replaceLocalDraftSessionPath?: string | null },
  ) => Promise<unknown>
  refreshShellState: () => Promise<unknown>
  selectedSessionPath: string | null
  shellState: ShellState | null
  setArchivedThreads: Dispatch<SetStateAction<ArchivedThread[]>>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  showToast: (message: string) => void
  workspaceState: WorkspaceState
}

function getActionErrorMessage(actionResult: DesktopActionResult | null) {
  if (!actionResult) {
    return null
  }

  if (actionResult.ok === false && typeof actionResult.result?.error === 'string') {
    return cleanUserErrorMessage(actionResult.result.error)
  }

  return typeof actionResult.result?.error === 'string'
    ? cleanUserErrorMessage(actionResult.result.error)
    : null
}

function shouldShowGlobalActionError(action: DesktopAction) {
  return !(
    action === 'composer.send' ||
    action === 'composer.stop' ||
    action === 'workspace.commit' ||
    action === 'workspace.commit-options' ||
    action === 'workspace.diff-preferences' ||
    action === 'workspace.switch-branch' ||
    action === 'workspace.merge-worktree' ||
    action === 'workspace.merge-completed-worktrees'
  )
}

async function prepareDesktopActionPayload(input: {
  action: DesktopAction
  activeView: View
  composerProjectId: string
  dispatch: Dispatch<WorkspaceAction>
  invokeDesktopAction: DesktopActionInvoker
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean; replaceLocalDraftSessionPath?: string | null },
  ) => Promise<unknown>
  payload: ActionPayload
  queryClient: ReturnType<typeof useQueryClient>
  selectedSessionPath: string | null
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  shellState: ShellState | null
}): Promise<
  | { blockedResult: DesktopActionResult; contextualPayload?: never }
  | { blockedResult?: never; contextualPayload: ActionPayload }
> {
  const initialContextualPayload = buildContextualActionPayload({
    action: input.action,
    payload: input.payload,
    composerProjectId: input.composerProjectId,
    activeView: input.activeView,
    selectedSessionPath: input.selectedSessionPath,
  })

  if (input.action === 'composer.send' || input.action === 'thread.open') {
    const blockedResult = await guardBranchResume({
      action: input.action,
      invokeDesktopAction: input.invokeDesktopAction,
      loadProjectGitState: input.loadProjectGitState,
      payload: initialContextualPayload,
      shellState: input.shellState,
      onSwitchBranchSuccess: (switchPayload) =>
        applySwitchBranchPostEffect({
          contextualPayload: switchPayload,
          queryClient: input.queryClient,
          loadProjectGitState: input.loadProjectGitState,
          loadProjectThreads: input.loadProjectThreads,
          setProjectGitState: input.setProjectGitState,
        }),
    })
    if (blockedResult) return { blockedResult }
  }

  if (input.action !== 'composer.send') return { contextualPayload: initialContextualPayload }

  return applyOptimisticComposerThread({
    activeView: input.activeView,
    contextualPayload: initialContextualPayload,
    queryClient: input.queryClient,
    dispatch: input.dispatch,
    setChatSidebarState: input.setChatSidebarState,
    setLiveThreadData: input.setLiveThreadData,
  })
}

export function useDesktopActionHandlers({
  activeView,
  composerProjectId,
  dispatch,
  invokeDesktopAction,
  loadArchivedThreads,
  loadComposerState,
  loadProjectGitState,
  loadProjectThreads,
  refreshShellState,
  selectedSessionPath,
  shellState,
  setArchivedThreads,
  setComposerState,
  setChatSidebarState,
  setLiveThreadData,
  setProjectGitState,
  showToast,
  workspaceState,
}: UseDesktopActionHandlersArgs) {
  const queryClient = useQueryClient()

  const runDesktopAction = useCallback(
    async (
      action: DesktopAction,
      payload: ActionPayload = {},
    ): Promise<DesktopActionResult | null> => {
      const preparedPayload = await prepareDesktopActionPayload({
        action,
        activeView,
        composerProjectId,
        dispatch,
        invokeDesktopAction,
        loadProjectGitState,
        loadProjectThreads,
        payload,
        queryClient,
        selectedSessionPath,
        setProjectGitState,
        setChatSidebarState,
        setLiveThreadData,
        shellState,
      })
      if (preparedPayload.blockedResult) return preparedPayload.blockedResult
      const { contextualPayload } = preparedPayload

      let actionResult: DesktopActionResult | null
      try {
        actionResult = await invokeDesktopAction(action, contextualPayload)
      } catch (error) {
        if (action === 'composer.send') {
          removeFailedOptimisticComposerThread({
            contextualPayload,
            setChatSidebarState,
            setLiveThreadData,
            queryClient,
          })
        }
        throw error
      }

      await runPostDesktopActionEffects({
        action,
        contextualPayload,
        actionResult,
        workspaceState,
        composerProjectId,
        dispatch,
        loadArchivedThreads,
        loadComposerState,
        loadProjectGitState,
        loadProjectThreads,
        refreshShellState,
        setArchivedThreads,
        setComposerState,
        setChatSidebarState,
        setLiveThreadData,
        setProjectGitState,
        queryClient,
      })

      const actionErrorMessage = getActionErrorMessage(actionResult)
      if (actionErrorMessage && shouldShowGlobalActionError(action)) {
        showToast(actionErrorMessage)
      }

      if (
        action === 'settings.update' &&
        (contextualPayload.key === 'devUpdateBranch' ||
          contextualPayload.key === 'betaUpdateBranch') &&
        !actionErrorMessage
      ) {
        void checkAppUpdateQuery()
      }

      return actionResult
    },
    [
      activeView,
      composerProjectId,
      dispatch,
      invokeDesktopAction,
      loadArchivedThreads,
      loadComposerState,
      loadProjectGitState,
      loadProjectThreads,
      refreshShellState,
      selectedSessionPath,
      shellState,
      setArchivedThreads,
      setComposerState,
      setChatSidebarState,
      setLiveThreadData,
      setProjectGitState,
      showToast,
      workspaceState,
      queryClient,
    ],
  )

  const handleAction = useCallback(
    async (
      action: DesktopAction,
      payload: ActionPayload = {},
    ): Promise<DesktopActionResult | null> => {
      // Optimistic updates happen before the desktop call so the renderer stays stable
      // while the background write and refresh pipeline converges.
      if (action === 'settings.update') {
        applyOptimisticSettingsUpdate(queryClient, payload)
      }

      if (action === 'pi-settings.update') {
        applyOptimisticPiSettingsUpdate(queryClient, payload)
      }

      if (action === 'project.edit-name') {
        applyOptimisticProjectRename(queryClient, payload)
      }

      if (action === 'thread.rename') {
        applyOptimisticThreadRename(queryClient, payload)
      }

      if (action === 'thread.pin' || action === 'project.pin') {
        applyOptimisticPinUpdate(queryClient, action, payload)
      }

      return await runDesktopAction(action, payload)
    },
    [queryClient, runDesktopAction],
  )

  return {
    handleAction,
    runDesktopAction,
  }
}
