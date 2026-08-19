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
    Partial<Pick<WorktreeLifecycleResult, 'error' | 'failedThreadIds'>>,
): WorktreeLifecycleResult {
  return {
    rootProjectId: worktree.rootProjectId,
    projectId: worktree.worktreePath,
    branchName: worktree.branchName,
    ...details,
  }
}

export async function removeRegisteredWorktree(input: {
  worktree: RegisteredWorktree
  merge: boolean
  pruneBranch: boolean
}): Promise<WorktreeLifecycleResult> {
  const { worktree } = input
  if (input.merge) {
    const targetError = getWorktreeMergeTargetError(worktree)
    if (targetError) {
      return resultFor(worktree, {
        didMutate: false,
        worktreeRemoved: false,
        error: targetError,
      })
    }
  }

  await disposeWorkspaceSessions(worktree.worktreePath)

  if (input.merge && worktree.branchName) {
    const mergeResult = await mergeProjectBranch(worktree.rootProjectId, worktree.branchName)
    if ('error' in mergeResult) {
      return resultFor(worktree, {
        didMutate: mergeResult.didMutate === true,
        worktreeRemoved: false,
        error: mergeResult.error,
      })
    }
    setProjectWorktreeCompleted(worktree.worktreePath, true)
  }

  const threadIds = listProjectThreadIds(worktree.worktreePath)
  const removeResult = await removeProjectWorktree(worktree.rootProjectId, worktree.worktreePath)
  if ('error' in removeResult) {
    return resultFor(worktree, {
      didMutate: input.merge,
      worktreeRemoved: false,
      error: removeResult.error,
    })
  }

  const branchResult =
    input.pruneBranch && worktree.branchName
      ? await pruneProjectBranch(worktree.rootProjectId, worktree.branchName)
      : null
  const threadCleanup = await deleteWorkspaceThreads(threadIds)
  if (!threadCleanup) deleteProject(worktree.worktreePath)

  const errors = [
    branchResult && 'error' in branchResult ? branchResult.error : null,
    threadCleanup?.error,
  ]
    .filter((error): error is string => Boolean(error))
    .join(' ')

  return resultFor(worktree, {
    didMutate: true,
    worktreeRemoved: true,
    ...(errors ? { error: errors } : {}),
    ...(threadCleanup?.failedThreadIds ? { failedThreadIds: threadCleanup.failedThreadIds } : {}),
  })
}
