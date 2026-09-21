import { databaseOperation } from './thread-state-db/db.ts'
import * as queries from './thread-state-db/queries.ts'
import * as writes from './thread-state-db/writes.ts'

export type { SessionSummaryRecord } from './thread-state-db/types.ts'
export type {
  ProjectWorktreeMetadata,
  ProjectWorktreeSource,
  RegisterManagedWorktreeInput,
  StoredProjectWorktree,
} from './thread-state-db/writes.ts'

export const getProjectStoredUsageTotals = databaseOperation(queries.getProjectStoredUsageTotals)
export const getThreadAssistantSnapshot = databaseOperation(queries.getThreadAssistantSnapshot)
export const getThreadCwd = databaseOperation(queries.getThreadCwd)
export const getThreadDeletionSnapshot = databaseOperation(queries.getThreadDeletionSnapshot)
export const getThreadDiffPreferences = databaseOperation(queries.getThreadDiffPreferences)
export const getThreadSessionPath = databaseOperation(queries.getThreadSessionPath)
export const hasInboxItem = databaseOperation(queries.hasInboxItem)
export const hasProject = databaseOperation(queries.hasProject)
export const hasRunningProjectThread = databaseOperation(queries.hasRunningProjectThread)
export const listArchivedProjectThreads = databaseOperation(queries.listArchivedProjectThreads)
export const listArchivedThreads = databaseOperation(queries.listArchivedThreads)
export const listBranchSessionPaths = databaseOperation(queries.listBranchSessionPaths)
export const listBranchThreadIds = databaseOperation(queries.listBranchThreadIds)
export const listInboxThreads = databaseOperation(queries.listInboxThreads)
export const listProjectFamilyBranchThreadIds = databaseOperation(
  queries.listProjectFamilyBranchThreadIds,
)
export const listProjectFamilyProjectIds = databaseOperation(queries.listProjectFamilyProjectIds)
export const listProjectFamilySessionPaths = databaseOperation(
  queries.listProjectFamilySessionPaths,
)
export const listProjectSessionPaths = databaseOperation(queries.listProjectSessionPaths)
export const listProjects = databaseOperation(queries.listProjects)
export const listProjectThreadIds = databaseOperation(queries.listProjectThreadIds)
export const listProjectThreads = databaseOperation(queries.listProjectThreads)

export const addProjectUsageTotals = databaseOperation(writes.addProjectUsageTotals)
export const archiveProjectThreads = databaseOperation(writes.archiveProjectThreads)
export const archiveThread = databaseOperation(writes.archiveThread)
export const archiveThreads = databaseOperation(writes.archiveThreads)
export const assignThreadBranch = databaseOperation(writes.assignThreadBranch)
export const assignThreadToProjectBranch = databaseOperation(writes.assignThreadToProjectBranch)
export const beginInboxThreadTurn = databaseOperation(writes.beginInboxThreadTurn)
export const clearReadInboxThreads = databaseOperation(writes.clearReadInboxThreads)
export const collapseAllProjects = databaseOperation(writes.collapseAllProjects)
export const consumeInboxReplySuppression = databaseOperation(writes.consumeInboxReplySuppression)
export const deleteProject = databaseOperation(writes.deleteProject)
export const deleteProjectWorktreeMetadata = databaseOperation(writes.deleteProjectWorktreeMetadata)
export const deleteThreadRecord = databaseOperation(writes.deleteThreadRecord)
export const deleteThreadRecordsBySessionPaths = databaseOperation(
  writes.deleteThreadRecordsBySessionPaths,
)
export const dismissInboxThread = databaseOperation(writes.dismissInboxThread)
export const dismissInboxThreadAfterReply = databaseOperation(writes.dismissInboxThreadAfterReply)
export const ensureProject = databaseOperation(writes.ensureProject)
export const getProjectWorktree = databaseOperation(writes.getProjectWorktree)
export const getProjectWorktreeDirectory = databaseOperation(writes.getProjectWorktreeDirectory)
export const hideProject = databaseOperation(writes.hideProject)
export const listProjectWorktreePaths = databaseOperation(writes.listProjectWorktreePaths)
export const markInboxThreadRead = databaseOperation(writes.markInboxThreadRead)
export const registerManagedWorktree = databaseOperation(writes.registerManagedWorktree)
export const renameProject = databaseOperation(writes.renameProject)
export const renameThreadTitle = databaseOperation(writes.renameThreadTitle)
export const restoreThread = databaseOperation(writes.restoreThread)
export const restoreThreads = databaseOperation(writes.restoreThreads)
export const setProjectCollapsed = databaseOperation(writes.setProjectCollapsed)
export const setProjectGitOpsMode = databaseOperation(writes.setProjectGitOpsMode)
export const setProjectRepoOrigin = databaseOperation(writes.setProjectRepoOrigin)
export const setProjectWorktreeCompleted = databaseOperation(writes.setProjectWorktreeCompleted)
export const setProjectWorktreeDirectory = databaseOperation(writes.setProjectWorktreeDirectory)
export const setThreadDiffPreferences = databaseOperation(writes.setThreadDiffPreferences)
export const setThreadRunningState = databaseOperation(writes.setThreadRunningState)
export const syncSessionSummaries = databaseOperation(writes.syncSessionSummaries)
export const toggleProjectPinned = databaseOperation(writes.toggleProjectPinned)
export const toggleThreadPinned = databaseOperation(writes.toggleThreadPinned)
export const upsertInboxThreadMessage = databaseOperation(writes.upsertInboxThreadMessage)
export const upsertInboxThreadPrompt = databaseOperation(writes.upsertInboxThreadPrompt)
export const upsertProjectWorktree = databaseOperation(writes.upsertProjectWorktree)
export const upsertThreadSummary = databaseOperation(writes.upsertThreadSummary)
