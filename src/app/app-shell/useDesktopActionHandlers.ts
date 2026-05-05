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
  ThreadData,
} from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import type { View } from '../types'
import { buildContextualActionPayload } from './controller-action-helpers'
import {
  applyOptimisticPinUpdate,
  applyOptimisticPiSettingsUpdate,
  applyOptimisticProjectRename,
  applyOptimisticSettingsUpdate,
  runPostDesktopActionEffects,
} from './controller-post-action-effects'
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
  loadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  refreshShellState: () => Promise<unknown>
  selectedSessionPath: string | null
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
    action === 'workspace.diff-preferences'
  )
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
      // Build the renderer-context payload first so optimistic UI and desktop writes
      // operate against the same project/session selection.
      const initialContextualPayload = buildContextualActionPayload({
        action,
        payload,
        composerProjectId,
        activeView,
        selectedSessionPath,
      })
      const { contextualPayload } =
        action === 'composer.send'
          ? applyOptimisticComposerThread({
              activeView,
              contextualPayload: initialContextualPayload,
              queryClient,
              dispatch,
              setChatSidebarState,
              setLiveThreadData,
            })
          : { contextualPayload: initialContextualPayload }

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
