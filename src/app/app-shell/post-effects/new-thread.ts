import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import type { ComposerState, DesktopActionResult } from '../../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../../state/workspace'
import {
  type ActionPayload,
  getPayloadProjectId,
  hasDesktopBridge,
} from '../controller-action-utils'
import { upsertShellProject } from '../project-shell-cache'
import { applyProjectThreadToShellState } from '../project-thread-cache'
import {
  buildLocalThreadFallback,
  buildOptimisticThread,
  getInitialThreadBranchName,
} from '../thread-drafts'

type NewThreadPostEffectInput = {
  action: 'thread.new' | 'project.add'
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  composerProjectId: string
  queryClient: QueryClient
  dispatch: Dispatch<WorkspaceAction>
  refreshShellState: () => Promise<unknown>
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean; replaceLocalDraftSessionPath?: string | null },
  ) => Promise<unknown>
  loadComposerState: (request?: {
    projectId?: string | null
    composerMode?: 'chat' | 'code' | null
  }) => Promise<ComposerState | null>
  setComposerState: (state: ComposerState | null) => void
}

function getNewThreadResult(input: NewThreadPostEffectInput) {
  const projectId = getPayloadProjectId(input.contextualPayload) ?? input.composerProjectId
  const resultProjectId =
    typeof input.actionResult?.result?.projectId === 'string'
      ? input.actionResult.result.projectId
      : null
  const sessionPath =
    typeof input.actionResult?.result?.sessionPath === 'string'
      ? input.actionResult.result.sessionPath
      : null
  const threadId =
    typeof input.actionResult?.result?.threadId === 'string'
      ? input.actionResult.result.threadId
      : null
  const localFallback =
    !(threadId || sessionPath) && projectId && !hasDesktopBridge()
      ? buildLocalThreadFallback(projectId, {
          branchName: getInitialThreadBranchName(input.contextualPayload.branchName),
        })
      : null
  return { projectId, resultProjectId, sessionPath, threadId, localFallback }
}

function shouldStayOnCodeDashboard(input: NewThreadPostEffectInput) {
  return input.action === 'project.add' && input.workspaceState.activeView === 'project'
}

function shouldShowCodeDashboard(input: NewThreadPostEffectInput) {
  return input.action === 'project.add'
}

function getRequestedComposerMode(input: NewThreadPostEffectInput): 'chat' | 'code' {
  if (input.action === 'project.add') return 'code'
  if (input.contextualPayload.composerMode === 'chat') return 'chat'
  if (input.contextualPayload.composerMode === 'code') return 'code'
  return input.workspaceState.activeView === 'chat' ? 'chat' : 'code'
}

function getComposerModeForNextView(input: NewThreadPostEffectInput): 'chat' | 'code' {
  return getRequestedComposerMode(input)
}

function applyOptimisticThread(
  input: NewThreadPostEffectInput,
  thread: { projectId: string; threadId: string; sessionPath: string },
) {
  const optimisticThread = buildOptimisticThread({
    id: thread.threadId,
    sessionPath: thread.sessionPath,
    branchName: getInitialThreadBranchName(input.contextualPayload.branchName),
  })
  applyProjectThreadToShellState(input.queryClient, thread.projectId, optimisticThread, {
    revealProject: true,
  })
  return optimisticThread
}

function openOptimisticThread(
  input: NewThreadPostEffectInput,
  thread: { projectId: string; threadId: string; sessionPath: string },
) {
  const optimisticThread = applyOptimisticThread(input, thread)
  input.dispatch({
    type: 'open-thread',
    projectId: thread.projectId,
    threadId: thread.threadId,
    sessionPath: thread.sessionPath,
    view: getRequestedComposerMode(input) === 'chat' ? 'chat' : 'thread',
  })
  return optimisticThread
}

function startOptimisticProjectThread(
  input: NewThreadPostEffectInput,
  thread: { projectId: string; threadId: string; sessionPath: string },
) {
  const optimisticThread = applyOptimisticThread(input, thread)
  input.dispatch({
    type: 'start-project-thread',
    projectId: thread.projectId,
    threadId: thread.threadId,
    sessionPath: thread.sessionPath,
  })
  return optimisticThread
}

async function handleNewThreadBridgeResult(
  input: NewThreadPostEffectInput,
  result: ReturnType<typeof getNewThreadResult>,
) {
  const nextProjectId = result.resultProjectId ?? result.projectId
  if (!(nextProjectId && result.threadId && result.sessionPath)) return false
  if (shouldShowCodeDashboard(input)) {
    startOptimisticProjectThread(input, {
      projectId: nextProjectId,
      threadId: result.threadId,
      sessionPath: result.sessionPath,
    })
    return true
  }
  const optimisticThread = openOptimisticThread(input, {
    projectId: nextProjectId,
    threadId: result.threadId,
    sessionPath: result.sessionPath,
  })
  await input.loadProjectThreads(nextProjectId, {
    chat: getRequestedComposerMode(input) === 'chat',
  })
  applyProjectThreadToShellState(input.queryClient, nextProjectId, optimisticThread, {
    revealProject: true,
  })
  return true
}

async function handleNewThreadNavigation(
  input: NewThreadPostEffectInput,
  result: ReturnType<typeof getNewThreadResult>,
) {
  const nextProjectId = result.resultProjectId ?? result.projectId
  if (await handleNewThreadBridgeResult(input, result)) return
  if (shouldStayOnCodeDashboard(input) && nextProjectId) {
    input.dispatch({ type: 'select-project', projectId: nextProjectId })
    return
  }
  if (result.localFallback) {
    openOptimisticThread(input, {
      projectId: result.localFallback.projectId,
      threadId: result.localFallback.threadId,
      sessionPath: result.localFallback.sessionPath,
    })
    return
  }
  if (nextProjectId) {
    input.dispatch({ type: 'select-project', projectId: nextProjectId })
    return
  }
  input.dispatch({ type: 'show-view', view: 'code' })
}

export async function applyNewThreadPostEffect(input: NewThreadPostEffectInput) {
  const result = getNewThreadResult(input)
  if (input.action === 'project.add') {
    const projectId = result.resultProjectId ?? result.projectId
    if (projectId) {
      const projectName =
        typeof input.contextualPayload.projectName === 'string'
          ? input.contextualPayload.projectName
          : null
      upsertShellProject(
        input.queryClient,
        {
          id: projectId,
          ...(projectName ? { name: projectName } : {}),
        },
        { reveal: true },
      )
    }
  }
  await handleNewThreadNavigation(input, result)
  if (result.localFallback) return
  const nextComposerState =
    (input.action === 'thread.new' ? input.actionResult?.result?.composer : null) ??
    (await input.loadComposerState({
      projectId: result.resultProjectId ?? result.projectId,
      composerMode: getComposerModeForNextView(input),
    }))
  if (nextComposerState) input.setComposerState(nextComposerState)
}
