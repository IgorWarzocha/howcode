import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import type { ComposerState, DesktopActionResult } from '../../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../../state/workspace'
import {
  type ActionPayload,
  buildLocalThreadFallback,
  getPayloadProjectId,
  hasDesktopBridge,
} from '../controller-action-utils'
import { applyProjectThreadToShellState } from '../project-thread-cache'

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
          branchName:
            typeof input.contextualPayload.branchName === 'string'
              ? input.contextualPayload.branchName.trim() || null
              : null,
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

function getComposerModeForNextView(input: NewThreadPostEffectInput): 'chat' | 'code' {
  if (input.action === 'project.add') return 'code'
  return input.workspaceState.activeView === 'chat' ? 'chat' : 'code'
}

function applyOptimisticThread(
  input: NewThreadPostEffectInput,
  thread: { projectId: string; threadId: string; sessionPath: string },
) {
  const branchName =
    typeof input.contextualPayload.branchName === 'string' &&
    input.contextualPayload.branchName.trim().length > 0
      ? input.contextualPayload.branchName.trim()
      : undefined
  const optimisticThread = {
    id: thread.threadId,
    title: 'New thread',
    age: 'Now',
    lastModifiedMs: Date.now(),
    sessionPath: thread.sessionPath,
    branchName,
  }
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
    chat: input.workspaceState.activeView === 'chat',
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
  if (input.action === 'project.add') await input.refreshShellState()
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
