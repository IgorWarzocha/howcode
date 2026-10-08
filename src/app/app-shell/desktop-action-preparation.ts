import { applySwitchBranchPostEffect } from '@howcode/components/working-directories/ui'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type {
  ChatData,
  DesktopActionInvoker,
  DesktopActionResult,
  DirectoryGitState,
  ShellState,
  WorkspaceNavigationState,
} from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import type { View } from '../types'
import { guardBranchResume } from './branch-resume-guard'
import { buildContextualActionPayload } from './controller-action-helpers'
import type { ActionPayload } from './controller-action-utils'
import { applyOptimisticComposerChat } from './sidebar-chat-sync'

export async function prepareDesktopAction(input: {
  action: DesktopAction
  workspaceState: WorkspaceState
  activeView: View
  composerDirectoryId: string
  dispatch: Dispatch<WorkspaceAction>
  invokeDesktopAction: DesktopActionInvoker
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  loadDirectoryChats: (
    directoryId: string,
    options?: { replaceLocalDraftConversationId?: string | null },
  ) => Promise<unknown>
  payload: ActionPayload
  queryClient: QueryClient
  selectedConversationId: string | null
  setDirectoryGitState: Dispatch<SetStateAction<DirectoryGitState | null>>
  setWorkspaceNavigationState: Dispatch<SetStateAction<WorkspaceNavigationState | null>>
  setLiveChatData: Dispatch<SetStateAction<ChatData | null>>
  shellState: ShellState | null
}): Promise<
  | { blockedResult: DesktopActionResult; contextualPayload?: never }
  | { blockedResult?: never; contextualPayload: ActionPayload }
> {
  const contextualPayload = buildContextualActionPayload({
    action: input.action,
    composerProfile: input.workspaceState.composerProfile,
    workspaceId: input.workspaceState.selectedWorkspaceId,
    payload: input.payload,
    composerDirectoryId: input.composerDirectoryId,
    activeView: input.activeView,
    selectedConversationId: input.selectedConversationId,
  })

  if (input.action === 'composer.send' || input.action === 'chat.open') {
    const blockedResult = await guardBranchResume({
      action: input.action,
      invokeDesktopAction: input.invokeDesktopAction,
      loadDirectoryGitState: input.loadDirectoryGitState,
      payload: contextualPayload,
      shellState: input.shellState,
      onSwitchBranchSuccess: (switchPayload) =>
        applySwitchBranchPostEffect({
          contextualPayload: switchPayload,
          queryClient: input.queryClient,
          loadDirectoryGitState: input.loadDirectoryGitState,
          loadDirectoryChats: input.loadDirectoryChats,
          setDirectoryGitState: input.setDirectoryGitState,
        }),
    })
    if (blockedResult) return { blockedResult }
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
