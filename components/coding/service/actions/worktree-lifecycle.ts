import { deletePersistedThreads } from '../../../../desktop/app-service/thread-actions.ts'
import { abortWorkspaceConversations } from '../../../../desktop/conversation-runtime.ts'
import { withWorkspaceTeardown } from '../../../../desktop/runtime/workspace-activity.ts'
import {
  listProjectConversationIds,
  listProjectThreadIds,
  setThreadRunningState,
} from '../../../../desktop/thread-state-db.ts'
import type { CodingPeers } from '../dependencies.ts'
import { getActiveBranch } from '../project-git/project-state.ts'
import { mergeProjectBranch, pruneProjectBranch, removeProjectWorktree } from '../project-git.ts'
import type { RegisteredWorktree } from '../project-worktrees/registered-worktree.ts'
import {
  getWorktreeMergeTargetError,
  resolveRegisteredWorktree,
} from '../project-worktrees/registered-worktree.ts'
import { withRootGitMutation } from '../project-worktrees/root-git-mutation-gate.ts'
import { deleteProject, setProjectWorktreeCompleted } from '../state.ts'

export type WorktreeLifecycleResult = {
  didMutate: boolean
  rootProjectId: string
  projectId: string
  branchName: string | null
  worktreeCompleted?: boolean | undefined
  worktreeRemoved: boolean
  error?: string | undefined
  message?: string | undefined
  failedThreadIds?: string[] | undefined
}

async function stopWorkspaceConversationsAndTerminals(
  projectId: string,
  closeWorkspaceTerminals: CodingPeers['closeWorkspaceTerminals'],
) {
  const conversationIds = listProjectConversationIds(projectId)
  await abortWorkspaceConversations(conversationIds)
  for (const conversationId of conversationIds) setThreadRunningState(conversationId, false)
  await closeWorkspaceTerminals(projectId)
}

async function deleteWorkspaceThreads(threadIds: string[]) {
  const result = await deletePersistedThreads(threadIds)
  if (result.failedThreadIds.length === 0) return null
  return {
    error: `Failed to delete ${result.failedThreadIds.length} thread(s).`,
    failedThreadIds: result.failedThreadIds,
  }
}

function resultFor(
  worktree: RegisteredWorktree,
  details: Pick<WorktreeLifecycleResult, 'didMutate' | 'worktreeRemoved'> &
    Partial<
      Pick<WorktreeLifecycleResult, 'error' | 'failedThreadIds' | 'message' | 'worktreeCompleted'>
    >,
): WorktreeLifecycleResult {
  return {
    rootProjectId: worktree.rootProjectId,
    projectId: worktree.projectId,
    branchName: worktree.branchName,
    ...details,
  }
}

async function mergeRegisteredWorktree(worktree: RegisteredWorktree, merge: boolean) {
  if (!merge) return { didMutate: false, worktreeCompleted: false }
  const targetError = getWorktreeMergeTargetError({
    ...worktree,
    currentRootBranchName: await getActiveBranch(worktree.rootProjectId),
  })
  if (targetError) {
    return {
      didMutate: false,
      worktreeCompleted: false,
      error: targetError,
    }
  }

  if (!worktree.branchName) throw new Error('Validated merge target has no branch.')
  const mergeResult = await mergeProjectBranch(worktree.rootProjectId, worktree.branchName)
  if ('error' in mergeResult) {
    return {
      didMutate: mergeResult.didMutate === true,
      worktreeCompleted: false,
      error: mergeResult.error,
    }
  }

  return {
    didMutate: true,
    worktreeCompleted: setProjectWorktreeCompleted(worktree.projectId, true),
  }
}

async function refreshWorktreeAfterActivityStop(worktree: RegisteredWorktree) {
  const refreshed = await resolveRegisteredWorktree(worktree.rootProjectId, worktree.worktreePath)
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
  const threadIds = listProjectThreadIds(worktree.projectId)
  const removeResult = await removeProjectWorktree(
    worktree.rootProjectId,
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
      ? await pruneProjectBranch(worktree.rootProjectId, worktree.branchName)
      : null
  const threadCleanup = await deleteWorkspaceThreads(threadIds)
  if (!threadCleanup) deleteProject(worktree.projectId)

  const warnings = [
    removeResult.warning,
    branchResult && 'error' in branchResult ? branchResult.error : null,
    threadCleanup?.error,
  ]
    .filter((error): error is string => Boolean(error))
    .join(' ')

  return resultFor(worktree, {
    didMutate: true,
    worktreeRemoved: true,
    ...(mergeResult.worktreeCompleted ? { worktreeCompleted: true } : {}),
    ...(warnings ? { message: warnings } : {}),
    ...(threadCleanup?.failedThreadIds ? { failedThreadIds: threadCleanup.failedThreadIds } : {}),
  })
}

async function removeRegisteredWorktree(
  input: {
    worktree: RegisteredWorktree
    merge: boolean
    pruneBranch: boolean
  },
  peers: CodingPeers,
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

  return withWorkspaceTeardown(worktree.projectId, async () => {
    await stopWorkspaceConversationsAndTerminals(worktree.projectId, peers.closeWorkspaceTerminals)
    return withRootGitMutation(worktree.rootProjectId, async () => {
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

export function createWorktreeLifecycle(peers: CodingPeers) {
  return {
    deleteWorkspaceThreads,
    removeRegisteredWorktree: (input: Parameters<typeof removeRegisteredWorktree>[0]) =>
      removeRegisteredWorktree(input, peers),
  }
}
