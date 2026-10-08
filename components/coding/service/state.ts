import { databaseOperation } from '../../../desktop/chat-repository/db.ts'
import * as directories from './state/directory-writes.ts'
import * as queries from './state/queries.ts'
import * as worktrees from './state/worktree-writes.ts'

export { codingChatBranchFallbacks } from './state/chat-branches.ts'

export type {
  DirectoryWorktreeMetadata,
  DirectoryWorktreeSource,
  RegisterManagedWorktreeInput,
  StoredDirectoryWorktree,
} from './state/worktree-writes.ts'

export const getDirectoryStoredUsageTotals = databaseOperation(
  queries.getDirectoryStoredUsageTotals,
)
export const hasDirectory = databaseOperation(queries.hasDirectory)
export const hasRunningDirectoryChat = databaseOperation(queries.hasRunningDirectoryChat)
export const hasRetainedDirectoryFamilyConversations = databaseOperation(
  queries.hasRetainedDirectoryFamilyConversations,
)
export const listDirectoryFamilyBranchChatIds = databaseOperation(
  queries.listDirectoryFamilyBranchChatIds,
)
export const listDirectoryFamilyConversationIds = databaseOperation(
  queries.listDirectoryFamilyConversationIds,
)
export const listDirectoryFamilyDirectoryIds = databaseOperation(
  queries.listDirectoryFamilyDirectoryIds,
)
export const listDirectories = databaseOperation(queries.listDirectories)
export const setDirectoryCollapsed = databaseOperation(directories.setDirectoryCollapsed)
export const toggleDirectoryPinned = databaseOperation(directories.toggleDirectoryPinned)
export const collapseAllDirectories = databaseOperation(directories.collapseAllDirectories)
export const archiveDirectoryChats = databaseOperation(directories.archiveDirectoryChats)
export const renameDirectory = databaseOperation(directories.renameDirectory)
export const setDirectoryRepoOrigin = databaseOperation(directories.setDirectoryRepoOrigin)
export const setDirectoryGitOpsMode = databaseOperation(directories.setDirectoryGitOpsMode)
export const hideDirectory = databaseOperation(directories.hideDirectory)
export const deleteDirectory = databaseOperation(directories.deleteDirectory)
export const getDirectoryWorktree = databaseOperation(worktrees.getDirectoryWorktree)
export const getDirectoryWorktreeDirectory = databaseOperation(
  worktrees.getDirectoryWorktreeDirectory,
)
export const setDirectoryWorktreeDirectory = databaseOperation(
  worktrees.setDirectoryWorktreeDirectory,
)
export const upsertDirectoryWorktree = databaseOperation(worktrees.upsertDirectoryWorktree)
export const setDirectoryWorktreeCompleted = databaseOperation(
  worktrees.setDirectoryWorktreeCompleted,
)
export const listDirectoryWorktreePaths = databaseOperation(worktrees.listDirectoryWorktreePaths)
export const deleteDirectoryWorktreeMetadata = databaseOperation(
  worktrees.deleteDirectoryWorktreeMetadata,
)
export const registerManagedWorktree = databaseOperation(worktrees.registerManagedWorktree)
