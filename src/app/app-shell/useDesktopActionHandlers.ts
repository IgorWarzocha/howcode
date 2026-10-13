import { useSidebarRepositorySnapshot } from '@howaboua/howcode-sdk/sidebar-renderer'
import { useQueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type {
  AnyDesktopActionPayload,
  ArchivedChat,
  ChatData,
  ComposerState,
  DesktopActionInvoker,
  DesktopActionResult,
  DirectoryGitState,
  WorkspaceNavigationState,
} from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import type { View } from '../types'
import { applyOptimisticDesktopAction } from './controller-optimistic-updates'
import { runPostDesktopActionEffects } from './controller-post-action-effects'
import {
  getActionErrorMessage,
  getActionNoticeMessage,
  shouldShowGlobalActionError,
} from './desktop-action-error-policy'
import { prepareDesktopAction } from './desktop-action-preparation'
import { removeFailedOptimisticComposerChat } from './sidebar-chat-sync'

type ActionPayload = AnyDesktopActionPayload

function publishActionFeedback(input: {
  action: DesktopAction
  actionResult: DesktopActionResult | null
  showToast: (message: string) => void
}) {
  const errorMessage = getActionErrorMessage(input.actionResult)
  if (errorMessage && shouldShowGlobalActionError(input.action)) {
    input.showToast(errorMessage)
  }
  const noticeMessage = getActionNoticeMessage(input.action, input.actionResult)
  if (noticeMessage) input.showToast(noticeMessage)
  return errorMessage
}

type UseDesktopActionHandlersArgs = {
  activeView: View
  composerDirectoryId: string
  dispatch: Dispatch<WorkspaceAction>
  invokeDesktopAction: DesktopActionInvoker
  loadArchivedChats: () => Promise<ArchivedChat[]>
  loadComposerState: (request?: {
    directoryId?: string | null
    conversationId?: string | null
    composerProfile?: 'general' | 'coding' | null
  }) => Promise<ComposerState | null>
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  loadDirectoryChats: (
    directoryId: string,
    options?: { replaceLocalDraftConversationId?: string | null },
  ) => Promise<unknown>
  refreshShellState: () => Promise<unknown>
  selectedConversationId: string | null
  setArchivedChats: Dispatch<SetStateAction<ArchivedChat[]>>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setWorkspaceNavigationState: Dispatch<SetStateAction<WorkspaceNavigationState | null>>
  setLiveChatData: Dispatch<SetStateAction<ChatData | null>>
  setDirectoryGitState: Dispatch<SetStateAction<DirectoryGitState | null>>
  showToast: (message: string) => void
  workspaceState: WorkspaceState
}

export function useDesktopActionHandlers({
  activeView,
  composerDirectoryId,
  dispatch,
  invokeDesktopAction,
  loadArchivedChats,
  loadComposerState,
  loadDirectoryGitState,
  loadDirectoryChats,
  refreshShellState,
  selectedConversationId,
  setArchivedChats,
  setComposerState,
  setWorkspaceNavigationState,
  setLiveChatData,
  setDirectoryGitState,
  showToast,
  workspaceState,
}: UseDesktopActionHandlersArgs) {
  const { prepareAction: prepareRepositoryAction } = useSidebarRepositorySnapshot()
  const queryClient = useQueryClient()

  const runDesktopAction = useCallback(
    async (
      action: DesktopAction,
      payload: ActionPayload = {},
    ): Promise<DesktopActionResult | null> => {
      const preparedPayload = await prepareDesktopAction({
        prepareRepositoryAction,
        workspaceState,
        action,
        activeView,
        composerDirectoryId,
        dispatch,
        payload,
        queryClient,
        selectedConversationId,
        setWorkspaceNavigationState,
        setLiveChatData,
      })
      if (preparedPayload.blockedResult) return preparedPayload.blockedResult
      const { contextualPayload } = preparedPayload

      let actionResult: DesktopActionResult | null
      try {
        actionResult = await invokeDesktopAction(action, contextualPayload)
      } catch (error) {
        if (action === 'composer.send') {
          removeFailedOptimisticComposerChat({
            contextualPayload,
            setWorkspaceNavigationState,
            setLiveChatData,
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
        composerDirectoryId,
        dispatch,
        loadArchivedChats,
        loadComposerState,
        loadDirectoryGitState,
        loadDirectoryChats,
        refreshShellState,
        setArchivedChats,
        setComposerState,
        setWorkspaceNavigationState,
        setLiveChatData,
        setDirectoryGitState,
        queryClient,
      })

      publishActionFeedback({ action, actionResult, showToast })

      return actionResult
    },
    [
      prepareRepositoryAction,
      activeView,
      composerDirectoryId,
      dispatch,
      invokeDesktopAction,
      loadArchivedChats,
      loadComposerState,
      loadDirectoryGitState,
      loadDirectoryChats,
      refreshShellState,
      selectedConversationId,
      setArchivedChats,
      setComposerState,
      setWorkspaceNavigationState,
      setLiveChatData,
      setDirectoryGitState,
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
