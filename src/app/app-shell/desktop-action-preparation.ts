import type { SidebarRepositorySnapshot } from '@howaboua/howcode-sdk/sidebar-renderer'
import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type { ChatData, DesktopActionResult, WorkspaceNavigationState } from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import type { View } from '../types'
import { buildContextualActionPayload } from './controller-action-helpers'
import type { ActionPayload } from './controller-action-utils'
import { applyOptimisticComposerChat } from './sidebar-chat-sync'

export async function prepareDesktopAction(input: {
  prepareRepositoryAction?: SidebarRepositorySnapshot['prepareAction']
  action: DesktopAction
  workspaceState: WorkspaceState
  activeView: View
  composerDirectoryId: string
  dispatch: Dispatch<WorkspaceAction>
  payload: ActionPayload
  queryClient: QueryClient
  selectedConversationId: string | null
  setWorkspaceNavigationState: Dispatch<SetStateAction<WorkspaceNavigationState | null>>
  setLiveChatData: Dispatch<SetStateAction<ChatData | null>>
}): Promise<
  | { blockedResult: DesktopActionResult; contextualPayload?: never }
  | { blockedResult?: never; contextualPayload: ActionPayload }
> {
  const contextualPayload = buildContextualActionPayload({
    action: input.action,
    workspaceId: input.workspaceState.selectedWorkspaceId,
    payload: {
      ...(!getPersistedConversationId(input.selectedConversationId) &&
      input.workspaceState.composerExtensions !== null
        ? { composerExtensions: input.workspaceState.composerExtensions }
        : {}),
      ...input.payload,
    },
    composerDirectoryId: input.composerDirectoryId,
    activeView: input.activeView,
    selectedConversationId: input.selectedConversationId,
  })

  if (input.action === 'composer.send' || input.action === 'chat.open') {
    const error = await input.prepareRepositoryAction?.({
      action: input.action,
      directoryId:
        typeof contextualPayload.directoryId === 'string' ? contextualPayload.directoryId : null,
      conversationId:
        typeof contextualPayload.conversationId === 'string'
          ? contextualPayload.conversationId
          : null,
      branchName:
        typeof contextualPayload.branchName === 'string' ? contextualPayload.branchName : null,
    })
    if (error)
      return {
        blockedResult: {
          ok: false,
          at: new Date().toISOString(),
          payload: { action: input.action, payload: contextualPayload },
          result: { error },
        },
      }
  }

  if (input.action !== 'composer.send') return { contextualPayload }

  return applyOptimisticComposerChat({
    activeView: input.activeView,
    contextualPayload,
    queryClient: input.queryClient,
    dispatch: input.dispatch,
    setWorkspaceNavigationState: input.setWorkspaceNavigationState,
    setLiveChatData: input.setLiveChatData,
  })
}
