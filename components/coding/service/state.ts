import { databaseOperation } from '../../../desktop/thread-state-db/db.ts'
import * as projects from './state/project-writes.ts'
import * as queries from './state/queries.ts'
import * as worktrees from './state/worktree-writes.ts'

export { codingThreadBranchFallbacks } from './state/thread-branches.ts'

export type {
  ProjectWorktreeMetadata,
  ProjectWorktreeSource,
  RegisterManagedWorktreeInput,
  StoredProjectWorktree,
} from './state/worktree-writes.ts'

export const getProjectStoredUsageTotals = databaseOperation(queries.getProjectStoredUsageTotals)
export const hasProject = databaseOperation(queries.hasProject)
export const hasRunningProjectThread = databaseOperation(queries.hasRunningProjectThread)
export const hasRetainedProjectFamilyConversations = databaseOperation(
  queries.hasRetainedProjectFamilyConversations,
)
export const listProjectFamilyBranchThreadIds = databaseOperation(
  queries.listProjectFamilyBranchThreadIds,
)
export const listProjectFamilyConversationIds = databaseOperation(
  queries.listProjectFamilyConversationIds,
)
export const listProjectFamilyProjectIds = databaseOperation(queries.listProjectFamilyProjectIds)
export const listProjects = databaseOperation(queries.listProjects)
export const setProjectCollapsed = databaseOperation(projects.setProjectCollapsed)
export const toggleProjectPinned = databaseOperation(projects.toggleProjectPinned)
export const collapseAllProjects = databaseOperation(projects.collapseAllProjects)
export const archiveProjectThreads = databaseOperation(projects.archiveProjectThreads)
export const renameProject = databaseOperation(projects.renameProject)
export const setProjectRepoOrigin = databaseOperation(projects.setProjectRepoOrigin)
export const setProjectGitOpsMode = databaseOperation(projects.setProjectGitOpsMode)
export const hideProject = databaseOperation(projects.hideProject)
export const deleteProject = databaseOperation(projects.deleteProject)
export const getProjectWorktree = databaseOperation(worktrees.getProjectWorktree)
export const getProjectWorktreeDirectory = databaseOperation(worktrees.getProjectWorktreeDirectory)
export const setProjectWorktreeDirectory = databaseOperation(worktrees.setProjectWorktreeDirectory)
export const upsertProjectWorktree = databaseOperation(worktrees.upsertProjectWorktree)
export const setProjectWorktreeCompleted = databaseOperation(worktrees.setProjectWorktreeCompleted)
export const listProjectWorktreePaths = databaseOperation(worktrees.listProjectWorktreePaths)
export const deleteProjectWorktreeMetadata = databaseOperation(
  worktrees.deleteProjectWorktreeMetadata,
)
export const registerManagedWorktree = databaseOperation(worktrees.registerManagedWorktree)
