import { unlink } from 'node:fs/promises'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import {
  getComposerRequest,
  getSessionPath,
  getThreadId,
  getThreadIds,
} from '../../shared/pi-thread-action-payloads.ts'
import { deleteArtifactsForConversation } from '../artifact-state-db.ts'
import { deleteChatThread } from '../chat-state-db.ts'
import { openThreadRuntime, startNewThread } from '../pi-desktop-runtime.ts'
import {
  archiveThread,
  archiveThreads,
  clearReadInboxThreads,
  deleteThreadRecord,
  dismissInboxThread,
  getThreadSessionPath,
  markInboxThreadRead,
  restoreThread,
  restoreThreads,
  toggleThreadPinned,
} from '../thread-state-db.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

async function deletePersistedThread(threadId: string) {
  const sessionPath = getThreadSessionPath(threadId)
  if (sessionPath) {
    try {
      await unlink(sessionPath)
    } catch (error) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      ) {
        throw error
      }
    }
  }

  if (sessionPath) {
    deleteArtifactsForConversation(sessionPath)
    deleteChatThread(sessionPath)
  }
  deleteThreadRecord(threadId)
}

async function deletePersistedThreads(threadIds: string[]) {
  const deletedThreadIds: string[] = []
  const failedThreadIds: string[] = []

  for (const threadId of threadIds) {
    try {
      await deletePersistedThread(threadId)
      deletedThreadIds.push(threadId)
    } catch (error) {
      console.warn(`Failed to delete persisted thread: ${threadId}`, error)
      failedThreadIds.push(threadId)
    }
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

const threadActionHandlers = {
  'thread.pin': (payload) => {
    const threadId = getThreadId(payload)
    if (threadId) toggleThreadPinned(threadId)
    return handledAction()
  },
  'thread.open': async (payload) => {
    const sessionPath = getSessionPath(payload)
    await openThreadRuntime(getComposerRequest(payload))
    if (sessionPath) markInboxThreadRead(sessionPath)
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
  'thread.new': async (payload) => handledAction(await startNewThread(getComposerRequest(payload))),
  'inbox.mark-read': (payload) => {
    const sessionPath = getSessionPath(payload)
    if (sessionPath) markInboxThreadRead(sessionPath)
    return handledAction()
  },
  'inbox.dismiss': (payload) => {
    const sessionPath = getSessionPath(payload)
    if (sessionPath) dismissInboxThread(sessionPath)
    return handledAction()
  },
  'inbox.clear-read': (payload) => {
    const olderThanDays = typeof payload.olderThanDays === 'number' ? payload.olderThanDays : null
    const olderThanMs = olderThanDays ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000 : null
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
