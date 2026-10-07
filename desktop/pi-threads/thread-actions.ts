import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import {
  getBranchName,
  getComposerRequest,
  getConversationId,
  getProjectId,
  getThreadId,
  getThreadIds,
} from '../../shared/pi-thread-action-payloads.ts'
import { deleteArtifactsForConversation } from '../artifact-state-db.ts'
import { deleteChatThread } from '../chat-state-db.ts'
import { deleteRuntimeConversation } from '../durable-runtime/host.ts'
import { openThreadRuntime, startNewThread } from '../pi-desktop-runtime.ts'
import {
  archiveThread,
  archiveThreads,
  assignThreadBranch,
  assignThreadToProjectBranch,
  clearReadInboxThreads,
  deleteThreadRecord,
  dismissInboxThread,
  getThreadConversationId,
  markInboxThreadRead,
  renameThreadTitle,
  restoreThread,
  restoreThreads,
  toggleThreadPinned,
} from '../thread-state-db.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

async function deletePersistedThread(threadId: string) {
  const conversationId = getThreadConversationId(threadId)
  if (conversationId) {
    await deleteRuntimeConversation(conversationId)
    deleteArtifactsForConversation(conversationId)
    deleteChatThread(conversationId)
  }
  deleteThreadRecord(threadId)
}

export async function deletePersistedThreads(threadIds: string[]) {
  const deletedThreadIds: string[] = []
  const failedThreadIds: string[] = []

  const results = await [...new Set(threadIds)].reduce<
    Promise<Array<{ threadId: string; deleted: boolean }>>
  >(
    (pending, threadId) =>
      pending.then(async (completed) => {
        try {
          await deletePersistedThread(threadId)
          completed.push({ threadId, deleted: true })
        } catch (error) {
          console.warn(`Failed to delete persisted thread: ${threadId}`, error)
          completed.push({ threadId, deleted: false })
        }
        return completed
      }),
    Promise.resolve([]),
  )
  for (const { threadId, deleted } of results) {
    if (deleted) deletedThreadIds.push(threadId)
    else failedThreadIds.push(threadId)
  }

  return {
    deletedThreadIds,
    failedThreadIds,
  }
}

type ThreadActionHandler = (
  payload: AnyDesktopActionPayload,
) => Promise<ActionHandlerResult> | ActionHandlerResult

async function deleteManyThreadsFromPayload(payload: AnyDesktopActionPayload) {
  const threadIds = getThreadIds(payload)
  if (threadIds.length === 0) return handledAction()

  const deleteResult = await deletePersistedThreads(threadIds)
  if (deleteResult.failedThreadIds.length > 0) {
    return handledAction({
      deletedThreadIds: deleteResult.deletedThreadIds,
      didMutate: deleteResult.deletedThreadIds.length > 0,
      error: `Failed to delete ${deleteResult.failedThreadIds.length} thread(s).`,
      failedThreadIds: deleteResult.failedThreadIds,
    })
  }

  return handledAction({ deletedThreadIds: deleteResult.deletedThreadIds })
}

function getRenameValue(payload: AnyDesktopActionPayload) {
  return typeof payload.value === 'string' ? payload.value.trim() : ''
}

async function renameThreadFromPayload(payload: AnyDesktopActionPayload) {
  const threadId = getThreadId(payload)
  const name = getRenameValue(payload)
  if (!(threadId && name)) return handledAction()

  const conversationId = getConversationId(payload) ?? getThreadConversationId(threadId)
  if (!conversationId) return handledAction({ error: 'Thread session not found.' })

  renameThreadTitle(threadId, name)
  return handledAction({ title: name, conversationId: conversationId, threadId })
}

const threadActionHandlers = {
  'thread.pin': (payload) => {
    const threadId = getThreadId(payload)
    if (threadId) toggleThreadPinned(threadId)
    return handledAction()
  },
  'thread.open': async (payload) => {
    const conversationId = getConversationId(payload)
    await openThreadRuntime(getComposerRequest(payload))
    if (conversationId) markInboxThreadRead(conversationId)
    return handledAction()
  },
  'thread.archive': (payload) => {
    const threadId = getThreadId(payload)
    if (threadId) archiveThread(threadId)
    return handledAction()
  },
  'thread.archive-many': (payload) => {
    const threadIds = getThreadIds(payload)
    if (threadIds.length > 0) archiveThreads(threadIds)
    return handledAction()
  },
  'thread.assign-branch': (payload) => {
    const threadId = getThreadId(payload)
    if (!threadId) return handledAction()
    return handledAction(
      assignThreadToProjectBranch(threadId, getBranchName(payload), getProjectId(payload)),
    )
  },
  'thread.restore': (payload) => {
    const threadId = getThreadId(payload)
    if (threadId) restoreThread(threadId)
    return handledAction()
  },
  'thread.restore-many': (payload) => {
    const threadIds = getThreadIds(payload)
    if (threadIds.length > 0) restoreThreads(threadIds)
    return handledAction()
  },
  'thread.delete': async (payload) => {
    const threadId = getThreadId(payload)
    if (threadId) await deletePersistedThread(threadId)
    return handledAction()
  },
  'thread.delete-many': deleteManyThreadsFromPayload,
  'thread.rename': renameThreadFromPayload,
  'thread.new': async (payload) => {
    const result = await startNewThread(getComposerRequest(payload))
    const branchName = getBranchName(payload)
    if (branchName) assignThreadBranch(result.threadId, branchName)
    return handledAction(result)
  },
  'inbox.mark-read': (payload) => {
    const conversationId = getConversationId(payload)
    if (conversationId) markInboxThreadRead(conversationId)
    return handledAction()
  },
  'inbox.dismiss': (payload) => {
    const conversationId = getConversationId(payload)
    if (conversationId) dismissInboxThread(conversationId)
    return handledAction()
  },
  'inbox.clear-read': (payload) => {
    const olderThanDays =
      typeof payload.olderThanDays === 'number' && Number.isFinite(payload.olderThanDays)
        ? Math.max(0, payload.olderThanDays)
        : null
    const olderThanMs =
      olderThanDays === null ? null : Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    return handledAction({ clearedCount: clearReadInboxThreads(olderThanMs) })
  },
} satisfies Partial<Record<DesktopAction, ThreadActionHandler>>

export async function handleThreadDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  const handlers: Partial<Record<DesktopAction, ThreadActionHandler>> = threadActionHandlers
  const handler = handlers[action]
  return handler ? await handler(payload) : unhandledAction()
}
