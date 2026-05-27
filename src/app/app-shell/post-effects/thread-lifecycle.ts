import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import type { ArchivedThread, DesktopActionResult } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../../state/workspace'
import { refreshArchivedThreadsIfOpen } from '../controller-action-helpers'
import {
  type ActionPayload,
  getPayloadProjectId,
  getPayloadProjectIds,
  getPayloadThreadIds,
  getResultThreadIds,
  isThreadList,
} from '../controller-action-utils'

type ThreadLifecycleInput = {
  action: string
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  queryClient: QueryClient
  dispatch: Dispatch<WorkspaceAction>
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean; replaceLocalDraftSessionPath?: string | null },
  ) => Promise<unknown>
  refreshShellState: () => Promise<unknown>
  setArchivedThreads: (threads: ArchivedThread[]) => void
  invalidateInboxThreads: () => Promise<unknown>
}

function getPayloadThreadId(payload: ActionPayload) {
  return typeof payload.threadId === 'string' ? payload.threadId : null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function clearSelectedThreadIfIncluded(input: ThreadLifecycleInput, threadIds: string[]) {
  const selectedThreadId = input.workspaceState.selectedThreadId
  if (!(selectedThreadId && new Set(threadIds).has(selectedThreadId))) return
  input.dispatch({ type: 'clear-thread-selection' })
  input.dispatch({
    type: 'show-view',
    view: input.workspaceState.activeView === 'chat' ? 'chat' : 'code',
  })
}

async function invalidateProjectUsage(input: ThreadLifecycleInput, projectIds: string[]) {
  const uniqueProjectIds = [...new Set(projectIds.filter((projectId) => projectId.length > 0))]
  await Promise.all(
    uniqueProjectIds.map((projectId) =>
      input.queryClient.invalidateQueries({
        queryKey: desktopQueryKeys.projectUsageSummary(projectId),
      }),
    ),
  )
}

export async function refreshArchivedIfVisible(input: ThreadLifecycleInput) {
  await refreshArchivedThreadsIfOpen({
    archivedThreadsVisible: input.workspaceState.activeView === 'archived',
    loadArchivedThreads: input.loadArchivedThreads,
    setArchivedThreads: input.setArchivedThreads,
  })
}

async function refreshMutatedThreadProjects(input: ThreadLifecycleInput) {
  const projectId = getPayloadProjectId(input.contextualPayload)
  if (input.action === 'thread.restore-many' || input.action === 'thread.delete-many') {
    await input.refreshShellState()
    const projectIds = [...new Set(getPayloadProjectIds(input.contextualPayload))]
    if (projectIds.length > 0)
      await Promise.all(projectIds.map((id) => input.loadProjectThreads(id)))
    await invalidateProjectUsage(input, projectIds)
    return
  }
  if (projectId) await input.loadProjectThreads(projectId)
  if (projectId) await invalidateProjectUsage(input, [projectId])
}

function getDeletedThreadIds(input: ThreadLifecycleInput) {
  if (input.action === 'thread.delete')
    return [getPayloadThreadId(input.contextualPayload)].filter((threadId) => threadId !== null)
  if (input.action !== 'thread.delete-many') return []
  const deletedBatchThreadIds = getResultThreadIds(input.actionResult?.result?.deletedThreadIds)
  return deletedBatchThreadIds.length > 0
    ? deletedBatchThreadIds
    : getPayloadThreadIds(input.contextualPayload)
}

export async function applyArchivedThreadPostEffect(input: ThreadLifecycleInput) {
  const projectId = getPayloadProjectId(input.contextualPayload)
  const resultAffectedProjectIds = Array.isArray(input.actionResult?.result?.affectedProjectIds)
    ? input.actionResult.result.affectedProjectIds.filter(isString)
    : []
  const affectedProjectIds = [...new Set([projectId, ...resultAffectedProjectIds].filter(isString))]
  if (input.action === 'thread.assign-branch' && affectedProjectIds.length > 1) {
    await input.refreshShellState()
  }
  await Promise.all(affectedProjectIds.map((id) => input.loadProjectThreads(id)))
  await invalidateProjectUsage(input, affectedProjectIds)
  if (input.action === 'thread.archive' || input.action === 'thread.archive-many') {
    await refreshArchivedIfVisible(input)
  }
  const archivedThreadIds =
    input.action === 'thread.archive'
      ? [getPayloadThreadId(input.contextualPayload)].filter((threadId) => threadId !== null)
      : input.action === 'thread.archive-many'
        ? getPayloadThreadIds(input.contextualPayload)
        : []
  clearSelectedThreadIfIncluded(input, archivedThreadIds)
  await input.invalidateInboxThreads()
}

export async function applyRestoreOrDeleteThreadPostEffect(input: ThreadLifecycleInput) {
  await refreshMutatedThreadProjects(input)
  input.setArchivedThreads(await input.loadArchivedThreads())
  clearSelectedThreadIfIncluded(input, getDeletedThreadIds(input))
  await input.invalidateInboxThreads()
}

export async function applyThreadOpenOrInboxPostEffect(input: ThreadLifecycleInput) {
  const projectId = getPayloadProjectId(input.contextualPayload)
  if (projectId) await input.loadProjectThreads(projectId)
  await input.invalidateInboxThreads()
}

export async function applyProjectArchiveThreadsPostEffect(input: ThreadLifecycleInput) {
  const projectId = getPayloadProjectId(input.contextualPayload)
  if (projectId) await input.loadProjectThreads(projectId)
  if (projectId) await invalidateProjectUsage(input, [projectId])
  await input.refreshShellState()
  await refreshArchivedIfVisible(input)
  if (input.contextualPayload.projectId === input.workspaceState.selectedProjectId)
    input.dispatch({ type: 'show-view', view: 'code' })
  await input.invalidateInboxThreads()
}

export async function applyProjectRemovePostEffect(
  input: ThreadLifecycleInput & { hasActionError: boolean },
) {
  if (input.hasActionError) {
    if (input.actionResult?.result?.didMutate !== true) return
    const projectId = getPayloadProjectId(input.contextualPayload)
    await input.refreshShellState()
    const refreshedThreads = projectId ? await input.loadProjectThreads(projectId) : null
    const selectedThreadId = input.workspaceState.selectedThreadId
    if (
      projectId === input.workspaceState.selectedProjectId &&
      selectedThreadId &&
      isThreadList(refreshedThreads) &&
      !refreshedThreads.some((thread) => thread.id === selectedThreadId)
    ) {
      input.dispatch({ type: 'show-view', view: 'code' })
    }
    await refreshArchivedIfVisible(input)
    await input.invalidateInboxThreads()
    return
  }

  if (input.contextualPayload.projectId === input.workspaceState.selectedProjectId)
    input.dispatch({ type: 'show-view', view: 'code' })
  await input.refreshShellState()
  await refreshArchivedIfVisible(input)
  await input.invalidateInboxThreads()
}
