import {
  repairConversationProjection as repairProjection,
  listProjectUsageConversations as usageConversations,
} from './thread-state-db/conversation-projection.ts'
import { databaseOperation } from './thread-state-db/db.ts'
import * as queries from './thread-state-db/queries.ts'
import * as writes from './thread-state-db/writes.ts'

export type { ConversationSummaryRecord } from './thread-state-db/types.ts'

export const getThreadCwd = databaseOperation(queries.getThreadCwd)
export const getThreadDiffPreferences = databaseOperation(queries.getThreadDiffPreferences)
export const getThreadConversationId = databaseOperation(queries.getThreadConversationId)
export const listArchivedProjectThreads = databaseOperation(queries.listArchivedProjectThreads)
export const listArchivedThreads = databaseOperation(queries.listArchivedThreads)
export const listBranchConversationIds = databaseOperation(queries.listBranchConversationIds)
export const listBranchThreadIds = databaseOperation(queries.listBranchThreadIds)
export const listInboxThreads = databaseOperation(queries.listInboxThreads)
export const listProjectConversationIds = databaseOperation(queries.listProjectConversationIds)
export const listProjectThreadIds = databaseOperation(queries.listProjectThreadIds)
export const listProjectThreads = databaseOperation(queries.listProjectThreads)

export const archiveThread = databaseOperation(writes.archiveThread)
export const archiveThreads = databaseOperation(writes.archiveThreads)
export const assignThreadBranch = databaseOperation(writes.assignThreadBranch)
export const assignThreadToProjectBranch = databaseOperation(writes.assignThreadToProjectBranch)
export const clearReadInboxThreads = databaseOperation(writes.clearReadInboxThreads)
export const deleteThreadRecord = databaseOperation(writes.deleteThreadRecord)
export const deleteThreadRecordsByConversationIds = databaseOperation(
  writes.deleteThreadRecordsByConversationIds,
)
export const dismissInboxThread = databaseOperation(writes.dismissInboxThread)
export const dismissInboxThreadAfterReply = databaseOperation(writes.dismissInboxThreadAfterReply)
export const ensureProject = databaseOperation(writes.ensureProject)
export const markInboxThreadRead = databaseOperation(writes.markInboxThreadRead)
export const renameThreadTitle = databaseOperation(writes.renameThreadTitle)
export const restoreThread = databaseOperation(writes.restoreThread)
export const restoreThreads = databaseOperation(writes.restoreThreads)
export const setThreadDiffPreferences = databaseOperation(writes.setThreadDiffPreferences)
export const setThreadRunningState = databaseOperation(writes.setThreadRunningState)
export const toggleThreadPinned = databaseOperation(writes.toggleThreadPinned)
export const upsertThreadSummary = databaseOperation(writes.upsertThreadSummary)

export const repairConversationProjection = databaseOperation(repairProjection)
export const listProjectUsageConversations = databaseOperation(usageConversations)
