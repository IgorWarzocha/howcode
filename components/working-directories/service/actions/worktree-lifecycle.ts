import {
  getActiveBranch,
  mergeDirectoryBranch,
  pruneDirectoryBranch,
  removeDirectoryWorktree,
  withRootGitMutation,
} from '@howaboua/howcode-git/service'
import { deletePersistedChats } from '../../../../desktop/app-service/chat-actions.ts'
import {
  listDirectoryChatIds,
  listDirectoryConversationIds,
  setChatRunningState,
} from '../../../../desktop/chat-repository.ts'
import { abortWorkspaceConversations } from '../../../../desktop/conversation-runtime.ts'
import { withDirectoryTeardown } from '../../../../desktop/runtime/directory-activity.ts'
import type { WorkingDirectoryPeers } from '../dependencies.ts'
import type { RegisteredWorktree } from '../directory-worktrees/registered-worktree.ts'
import {
  getWorktreeMergeTargetError,
  resolveRegisteredWorktree,
} from '../directory-worktrees/registered-worktree.ts'
import { deleteDirectory, setDirectoryWorktreeCompleted } from '../state.ts'

export type WorktreeLifecycleResult = {
  didMutate: boolean
  rootDirectoryId: string
  directoryId: string
  branchName: string | null
  worktreeCompleted?: boolean | undefined
  worktreeRemoved: boolean
  error?: string | undefined
  message?: string | undefined
  failedChatIds?: string[] | undefined
}

async function stopWorkspaceConversationsAndTerminals(
  directoryId: string,
  closeWorkspaceTerminals: WorkingDirectoryPeers['closeWorkspaceTerminals'],
) {
  const conversationIds = listDirectoryConversationIds(directoryId)
  await abortWorkspaceConversations(conversationIds)
  for (const conversationId of conversationIds) setChatRunningState(conversationId, false)
  await closeWorkspaceTerminals(directoryId)
}

async function deleteWorkspaceChats(chatIds: string[]) {
  const result = await deletePersistedChats(chatIds)
  if (result.failedChatIds.length === 0) return null
  return {
    error: `Failed to delete ${result.failedChatIds.length} chat(s).`,
    failedChatIds: result.failedChatIds,
  }
}

function resultFor(
  worktree: RegisteredWorktree,
  details: Pick<WorktreeLifecycleResult, 'didMutate' | 'worktreeRemoved'> &
    Partial<
      Pick<WorktreeLifecycleResult, 'error' | 'failedChatIds' | 'message' | 'worktreeCompleted'>
    >,
): WorktreeLifecycleResult {
  return {
    rootDirectoryId: worktree.rootDirectoryId,
    directoryId: worktree.directoryId,
    branchName: worktree.branchName,
    ...details,
  }
}

async function mergeRegisteredWorktree(worktree: RegisteredWorktree, merge: boolean) {
  if (!merge) return { didMutate: false, worktreeCompleted: false }
  const targetError = getWorktreeMergeTargetError({
    ...worktree,
    currentRootBranchName: await getActiveBranch(worktree.rootDirectoryId),
  })
  if (targetError) {
    return {
      didMutate: false,
      worktreeCompleted: false,
      error: targetError,
    }
  }

  if (!worktree.branchName) throw new Error('Validated merge target has no branch.')
  const mergeResult = await mergeDirectoryBranch(worktree.rootDirectoryId, worktree.branchName)
  if ('error' in mergeResult) {
    return {
      didMutate: mergeResult.didMutate === true,
      worktreeCompleted: false,
      error: mergeResult.error,
    }
  }

  return {
    didMutate: true,
    worktreeCompleted: setDirectoryWorktreeCompleted(worktree.directoryId, true),
  }
}

async function refreshWorktreeAfterActivityStop(worktree: RegisteredWorktree) {
  const refreshed = await resolveRegisteredWorktree(worktree.rootDirectoryId, worktree.worktreePath)
  if ('error' in refreshed) return refreshed
  if (refreshed.branchName !== worktree.branchName) {
    return { error: 'Worktree branch changed while its sessions were stopping.' }
  }
  return { worktree: refreshed }
}

async function finishWorktreeRemoval(input: {
  worktree: RegisteredWorktree
  mergeResult: Awaited<ReturnType<typeof mergeRegisteredWorktree>>
  pruneBranch: boolean
}) {
  const { worktree, mergeResult } = input
  const chatIds = listDirectoryChatIds(worktree.directoryId)
  const removeResult = await removeDirectoryWorktree(
    worktree.rootDirectoryId,
    worktree.worktreePath,
    worktree.branchName,
  )
  if ('error' in removeResult) {
    return resultFor(worktree, {
      didMutate: mergeResult.didMutate,
      worktreeRemoved: false,
      ...(mergeResult.worktreeCompleted ? { worktreeCompleted: true } : {}),
      error: removeResult.error,
    })
  }

  const branchResult =
    input.pruneBranch && worktree.branchName
      ? await pruneDirectoryBranch(worktree.rootDirectoryId, worktree.branchName)
      : null
  const chatCleanup = await deleteWorkspaceChats(chatIds)
  if (!chatCleanup) deleteDirectory(worktree.directoryId)

  const warnings = [
    removeResult.warning,
    branchResult && 'error' in branchResult ? branchResult.error : null,
    chatCleanup?.error,
  ]
    .filter((error): error is string => Boolean(error))
    .join(' ')

  return resultFor(worktree, {
    didMutate: true,
    worktreeRemoved: true,
    ...(mergeResult.worktreeCompleted ? { worktreeCompleted: true } : {}),
    ...(warnings ? { message: warnings } : {}),
    ...(chatCleanup?.failedChatIds ? { failedChatIds: chatCleanup.failedChatIds } : {}),
  })
}

async function removeRegisteredWorktree(
  input: {
    worktree: RegisteredWorktree
    merge: boolean
    pruneBranch: boolean
  },
  peers: WorkingDirectoryPeers,
): Promise<WorktreeLifecycleResult> {
  const { worktree } = input
  const targetError = input.merge ? getWorktreeMergeTargetError(worktree) : null
  if (targetError) {
    return resultFor(worktree, {
      didMutate: false,
      worktreeRemoved: false,
      error: targetError,
    })
  }

  return withDirectoryTeardown(worktree.directoryId, async () => {
    await stopWorkspaceConversationsAndTerminals(
      worktree.directoryId,
      peers.closeWorkspaceTerminals,
    )
    return withRootGitMutation(worktree.rootDirectoryId, async () => {
      const refreshed = await refreshWorktreeAfterActivityStop(worktree)
      if ('error' in refreshed) {
        return resultFor(worktree, {
          didMutate: false,
          worktreeRemoved: false,
          error: refreshed.error,
        })
      }
      const refreshedWorktree = refreshed.worktree

      const mergeResult = await mergeRegisteredWorktree(refreshedWorktree, input.merge)
      if (mergeResult.error) {
        return resultFor(refreshedWorktree, {
          didMutate: mergeResult.didMutate,
          worktreeRemoved: false,
          error: mergeResult.error,
        })
      }

      return finishWorktreeRemoval({
        worktree: refreshedWorktree,
        mergeResult,
        pruneBranch: input.pruneBranch,
      })
    })
  })
}

export function createWorktreeLifecycle(peers: WorkingDirectoryPeers) {
  return {
    deleteWorkspaceChats,
    removeRegisteredWorktree: (input: Parameters<typeof removeRegisteredWorktree>[0]) =>
      removeRegisteredWorktree(input, peers),
  }
}
