import type { ComposerStateRequest } from '@howcode/shared/desktop-composer-contracts'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import type { DesktopAction } from '../../desktop/actions'
import type {
  ArchivedChat,
  ChatData,
  ComposerState,
  DesktopActionResult,
  DirectoryGitState,
  WorkspaceNavigationState,
} from '../../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../../state/workspace-model'
import type { ActionPayload } from '../controller-action-utils'

export type RunPostDesktopActionEffectsInput = {
  action: DesktopAction
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  composerDirectoryId: string
  dispatch: Dispatch<WorkspaceAction>
  loadArchivedChats: () => Promise<ArchivedChat[]>
  loadComposerState: (request?: ComposerStateRequest) => Promise<ComposerState | null>
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  loadDirectoryChats: (
    directoryId: string,
    options?: { replaceLocalDraftConversationId?: string | null },
  ) => Promise<unknown>
  refreshShellState: () => Promise<unknown>
  setArchivedChats: (chats: ArchivedChat[]) => void
  setWorkspaceNavigationState: (
    updater: (state: WorkspaceNavigationState | null) => WorkspaceNavigationState | null,
  ) => void
  setComposerState: (state: ComposerState | null) => void
  setLiveChatData: (updater: (state: ChatData | null) => ChatData | null) => void
  setDirectoryGitState: (state: DirectoryGitState | null) => void
  queryClient: QueryClient
}

export type PostEffectsContext = RunPostDesktopActionEffectsInput & {
  invalidateInboxChats: () => Promise<unknown>
}

export type PostEffectHandler = {
  matches: (ctx: PostEffectsContext) => boolean
  run: (ctx: PostEffectsContext) => Promise<void> | void
}
