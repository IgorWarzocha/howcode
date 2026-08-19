import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import type { DesktopAction } from '../../desktop/actions'
import type {
  ArchivedThread,
  ChatSidebarState,
  ComposerState,
  DesktopActionResult,
  ProjectGitState,
  ThreadData,
} from '../../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../../state/workspace'
import type { ActionPayload } from '../controller-action-utils'

export type RunPostDesktopActionEffectsInput = {
  action: DesktopAction
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  composerProjectId: string
  dispatch: Dispatch<WorkspaceAction>
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  loadComposerState: (request?: {
    projectId?: string | null
    composerMode?: 'chat' | 'code' | null
  }) => Promise<ComposerState | null>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean; replaceLocalDraftSessionPath?: string | null },
  ) => Promise<unknown>
  refreshShellState: () => Promise<unknown>
  setArchivedThreads: (threads: ArchivedThread[]) => void
  setChatSidebarState: (
    updater: (state: ChatSidebarState | null) => ChatSidebarState | null,
  ) => void
  setComposerState: (state: ComposerState | null) => void
  setLiveThreadData: (updater: (state: ThreadData | null) => ThreadData | null) => void
  setProjectGitState: (state: ProjectGitState | null) => void
  queryClient: QueryClient
}

export type PostEffectsContext = RunPostDesktopActionEffectsInput & {
  invalidateInboxThreads: () => Promise<unknown>
}

export type PostEffectHandler = {
  matches: (ctx: PostEffectsContext) => boolean
  run: (ctx: PostEffectsContext) => Promise<void> | void
}
