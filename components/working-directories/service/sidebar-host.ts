import type { SidebarServiceHost } from '@howaboua/howcode-classic-navigation/service'
import { deletePersistedChats } from '../../../desktop/app-service/chat-actions.ts'
import { setDirectoryImportState } from '../../../desktop/app-settings/writers.ts'
import {
  assignChatToDirectoryBranch,
  ensureDirectory,
  listDirectoryChatIds,
  listDirectoryConversationIds,
  setChatRunningState,
} from '../../../desktop/chat-repository.ts'
import { abortWorkspaceConversations } from '../../../desktop/conversation-runtime.ts'
import { withDirectoryTeardown } from '../../../desktop/runtime/directory-activity.ts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory.ts'
import type { WorkingDirectoryPeers } from './dependencies.ts'
import {
  deleteDirectory,
  deleteDirectoryWorktreeMetadata,
  getDirectoryWorktree,
  getDirectoryWorktreeDirectory,
  hasRunningDirectoryChat,
  listDirectories,
  listDirectoryFamilyBranchChatIds,
  listDirectoryWorktreePaths,
  registerManagedWorktree,
  setDirectoryRepoOrigin,
  setDirectoryWorktreeCompleted,
  setDirectoryWorktreeDirectory,
  upsertDirectoryWorktree,
} from './state.ts'

/** Core facts and activity admission; Sidebar owns all Git and worktree decisions. */
export function createSidebarHost(peers: WorkingDirectoryPeers): SidebarServiceHost {
  return {
    getDesktopWorkingDirectory,
    listDirectories,
    ensureDirectory,
    setDirectoryImportState,
    setDirectoryRepoOrigin,
    deleteDirectoryWorktreeMetadata,
    upsertDirectoryWorktree,
    getDirectoryWorktree,
    listDirectoryWorktreePaths,
    getDirectoryWorktreeDirectory,
    setDirectoryWorktreeDirectory,
    setDirectoryWorktreeCompleted,
    registerManagedWorktree,
    deleteDirectory,
    hasRunningDirectoryChat,
    listDirectoryFamilyBranchChatIds,
    listDirectoryChatIds,
    listDirectoryConversationIds,
    abortWorkspaceConversations,
    setChatRunningState,
    deletePersistedChats,
    withDirectoryTeardown,
    closeWorkspaceTerminals: peers.closeWorkspaceTerminals,
    hasActiveWorkspaceTerminal: peers.hasActiveWorkspaceTerminal,
    assignChatBranch: assignChatToDirectoryBranch,
  }
}
