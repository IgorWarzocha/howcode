import { useQueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'
import type { DesktopAction } from '../desktop/actions'
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
import { applyOptimisticDesktopAction } from './controller-optimistic-updates'
import { runPostDesktopActionEffects } from './controller-post-action-effects'
import { getActionErrorMessage, shouldShowGlobalActionError } from './desktop-action-error-policy'
import { prepareDesktopAction } from './desktop-action-preparation'
import { removeFailedOptimisticComposerThread } from './sidebar-thread-sync'

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
      const preparedPayload = await prepareDesktopAction({
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
      applyOptimisticDesktopAction(queryClient, action, payload)
      return await runDesktopAction(action, payload)
    },
    [queryClient, runDesktopAction],
  )

  return {
    handleAction,
    runDesktopAction,
  }
}
