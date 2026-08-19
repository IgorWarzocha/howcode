import { disposeWorkspaceComposerRuns } from '../pi-desktop-runtime.ts'
import { mergeProjectBranch, pruneProjectBranch, removeProjectWorktree } from '../project-git.ts'
import type { RegisteredWorktree } from '../project-worktrees/registered-worktree.ts'
import { getWorktreeMergeTargetError } from '../project-worktrees/registered-worktree.ts'
import { closeTerminal, listTerminals } from '../terminal/runtime.ts'
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
  failedThreadIds?: string[] | undefined
}

async function closeWorkspaceTerminals(projectId: string) {
  const terminalSnapshots = await listTerminals()
  await Promise.all(
    terminalSnapshots.flatMap((snapshot) =>
      snapshot.projectId === projectId
        ? [closeTerminal({ sessionId: snapshot.sessionId, deleteHistory: true })]
        : [],
    ),
  )
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
    Partial<Pick<WorktreeLifecycleResult, 'error' | 'failedThreadIds' | 'worktreeCompleted'>>,
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
  if (!worktree.branchName) {
    return {
      didMutate: false,
      worktreeCompleted: false,
      error: 'Detached worktrees cannot be merged automatically.',
    }
  }

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

  await disposeWorkspaceSessions(worktree.worktreePath)

  const mergeResult = await mergeRegisteredWorktree(worktree, input.merge)
  if (mergeResult.error) {
    return resultFor(worktree, {
      didMutate: mergeResult.didMutate,
      worktreeRemoved: false,
      error: mergeResult.error,
    })
  }

  const threadIds = listProjectThreadIds(worktree.worktreePath)
  const removeResult = await removeProjectWorktree(worktree.rootProjectId, worktree.worktreePath)
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
  deleteProject(worktree.worktreePath)

  const errors = [
    branchResult && 'error' in branchResult ? branchResult.error : null,
    threadCleanup?.error,
  ]
    .filter((error): error is string => Boolean(error))
    .join(' ')

  return resultFor(worktree, {
    didMutate: true,
    worktreeRemoved: true,
    ...(mergeResult.worktreeCompleted ? { worktreeCompleted: true } : {}),
    ...(errors ? { error: errors } : {}),
    ...(threadCleanup?.failedThreadIds ? { failedThreadIds: threadCleanup.failedThreadIds } : {}),
  })
}
