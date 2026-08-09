import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type {
  ChatSidebarState,
  DesktopActionInvoker,
  DesktopActionResult,
  ProjectGitState,
  ShellState,
  ThreadData,
} from '../desktop/types'
import type { WorkspaceAction } from '../state/workspace'
import type { View } from '../types'
import { guardBranchResume } from './branch-resume-guard'
import { buildContextualActionPayload } from './controller-action-helpers'
import type { ActionPayload } from './controller-action-utils'
import { applySwitchBranchPostEffect } from './post-effects/workspace'
import { applyOptimisticComposerThread } from './sidebar-thread-sync'

export async function prepareDesktopAction(input: {
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
  queryClient: QueryClient
  selectedSessionPath: string | null
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  setChatSidebarState: Dispatch<SetStateAction<ChatSidebarState | null>>
  setLiveThreadData: Dispatch<SetStateAction<ThreadData | null>>
  shellState: ShellState | null
}): Promise<
  | { blockedResult: DesktopActionResult; contextualPayload?: never }
  | { blockedResult?: never; contextualPayload: ActionPayload }
> {
  const contextualPayload = buildContextualActionPayload({
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
      payload: contextualPayload,
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

  if (input.action !== 'composer.send') return { contextualPayload }

  return applyOptimisticComposerThread({
    activeView: input.activeView,
    contextualPayload,
    queryClient: input.queryClient,
    dispatch: input.dispatch,
    setChatSidebarState: input.setChatSidebarState,
    setLiveThreadData: input.setLiveThreadData,
  })
}
