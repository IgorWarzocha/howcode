import { disposeWorkspaceComposerRuns } from '../pi-desktop-runtime.ts'
import { getActiveBranch } from '../project-git/project-state.ts'
import { mergeProjectBranch, pruneProjectBranch, removeProjectWorktree } from '../project-git.ts'
import type { RegisteredWorktree } from '../project-worktrees/registered-worktree.ts'
import {
  getWorktreeMergeTargetError,
  resolveRegisteredWorktree,
} from '../project-worktrees/registered-worktree.ts'
import { withRootGitMutation } from '../project-worktrees/root-git-mutation-gate.ts'
import { withWorkspaceTeardown } from '../project-worktrees/workspace-teardown-gate.ts'
import { closeWorkspaceTerminals } from '../terminal/workspace-terminals.ts'
import {
  deleteProject,
  listProjectSessionPaths,
  listProjectThreadIds,
  setProjectWorktreeCompleted,
  setThreadRunningState,
} from '../thread-state-db.ts'
import { deletePersistedThreads } from './thread-actions.ts'

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

async function disposeWorkspaceSessions(projectId: string) {
  const sessionPaths = listProjectSessionPaths(projectId)
  await disposeWorkspaceComposerRuns({ projectPath: projectId, sessionPaths })
  for (const sessionPath of sessionPaths) setThreadRunningState(sessionPath, false)
  await closeWorkspaceTerminals(projectId)
}

export async function deleteWorkspaceThreads(threadIds: string[]) {
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
    projectId: worktree.worktreePath,
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
    worktreeCompleted: setProjectWorktreeCompleted(worktree.worktreePath, true),
  }
}

async function refreshWorktreeAfterSessionStop(worktree: RegisteredWorktree) {
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
  const threadIds = listProjectThreadIds(worktree.worktreePath)
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
  if (!threadCleanup) deleteProject(worktree.worktreePath)

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

export async function removeRegisteredWorktree(input: {
  worktree: RegisteredWorktree
  merge: boolean
  pruneBranch: boolean
}): Promise<WorktreeLifecycleResult> {
  const { worktree } = input
  const targetError = input.merge ? getWorktreeMergeTargetError(worktree) : null
  if (targetError) {
    return resultFor(worktree, {
      didMutate: false,
      worktreeRemoved: false,
      error: targetError,
    })
  }

  return withWorkspaceTeardown(worktree.worktreePath, async () => {
    await disposeWorkspaceSessions(worktree.worktreePath)
    return withRootGitMutation(worktree.rootProjectId, async () => {
      const refreshed = await refreshWorktreeAfterSessionStop(worktree)
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
