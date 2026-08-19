import { createReadStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import {
  getBranchName,
  getComposerRequest,
  getProjectId,
  getSessionPath,
  getThreadId,
  getThreadIds,
} from '../../shared/pi-thread-action-payloads.ts'
import { deleteArtifactsForConversation } from '../artifact-state-db.ts'
import { deleteChatThread } from '../chat-state-db.ts'
import { openThreadRuntime, startNewThread } from '../pi-desktop-runtime.ts'
import { invokeRuntimeHost } from '../runtime-host/client-bridge.ts'
import {
  addProjectUsageTotals,
  archiveThread,
  archiveThreads,
  assignThreadBranch,
  assignThreadToProjectBranch,
  clearReadInboxThreads,
  deleteThreadRecord,
  dismissInboxThread,
  getThreadDeletionSnapshot,
  getThreadSessionPath,
  markInboxThreadRead,
  renameThreadTitle,
  restoreThread,
  restoreThreads,
  toggleThreadPinned,
} from '../thread-state-db.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

type UsageTotals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  costTotal: number
  assistantTurnCount: number
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getAssistantUsage(entry: unknown) {
  if (
    typeof entry !== 'object' ||
    entry === null ||
    !('type' in entry) ||
    entry.type !== 'message'
  ) {
    return null
  }
  const message =
    typeof entry === 'object' && entry !== null && 'message' in entry ? entry.message : null
  if (
    typeof message !== 'object' ||
    message === null ||
    !('role' in message) ||
    message.role !== 'assistant' ||
    !('usage' in message) ||
    typeof message.usage !== 'object' ||
    message.usage === null
  ) {
    return null
  }

  return message.usage
}

function addUsageTotals(
  totals: UsageTotals,
  usage: NonNullable<ReturnType<typeof getAssistantUsage>>,
) {
  const cost = 'cost' in usage ? usage.cost : null
  totals.input += finiteNumber('input' in usage ? usage.input : undefined)
  totals.output += finiteNumber('output' in usage ? usage.output : undefined)
  totals.cacheRead += finiteNumber('cacheRead' in usage ? usage.cacheRead : undefined)
  totals.cacheWrite += finiteNumber('cacheWrite' in usage ? usage.cacheWrite : undefined)
  totals.totalTokens += finiteNumber('totalTokens' in usage ? usage.totalTokens : undefined)
  totals.costTotal += finiteNumber(
    typeof cost === 'object' && cost !== null && 'total' in cost ? cost.total : undefined,
  )
  totals.assistantTurnCount += 1
}

function isMissingFileError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

async function summarizeSessionUsageForStorage(sessionPath: string): Promise<UsageTotals> {
  const totals: UsageTotals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    costTotal: 0,
    assistantTurnCount: 0,
  }
  const lines = createInterface({
    input: createReadStream(sessionPath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  for await (const line of lines) {
    if (!line.trim()) continue
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    const usage = getAssistantUsage(entry)
    if (!usage) continue
    addUsageTotals(totals, usage)
  }

  return totals
}

async function storeUsageBeforeDelete(threadId: string, sessionPath: string) {
  const deletionSnapshot = getThreadDeletionSnapshot(threadId)
  if (!deletionSnapshot) return null
  let usage: Awaited<ReturnType<typeof summarizeSessionUsageForStorage>>
  try {
    usage = await summarizeSessionUsageForStorage(sessionPath)
  } catch (error) {
    if (!isMissingFileError(error)) throw error
    return null
  }
  return {
    cwd: deletionSnapshot.cwd,
    ...usage,
  }
}

async function unlinkSessionFile(sessionPath: string) {
  try {
    await unlink(sessionPath)
  } catch (error) {
    if (!isMissingFileError(error)) throw error
  }
}

async function deletePersistedThread(threadId: string) {
  const sessionPath = getThreadSessionPath(threadId)
  const usageSnapshot = sessionPath ? await storeUsageBeforeDelete(threadId, sessionPath) : null
  if (sessionPath) {
    await unlinkSessionFile(sessionPath)
    deleteArtifactsForConversation(sessionPath)
    deleteChatThread(sessionPath)
  }
  deleteThreadRecord(threadId)
  if (usageSnapshot) addProjectUsageTotals(usageSnapshot)
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

  const sessionPath = getSessionPath(payload) ?? getThreadSessionPath(threadId)
  if (!sessionPath) return handledAction({ error: 'Thread session not found.' })

  const result = await invokeRuntimeHost('renameThreadSession', { sessionPath, name })
  renameThreadTitle(threadId, result.title)
  return handledAction({ ...result, sessionPath, threadId })
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
