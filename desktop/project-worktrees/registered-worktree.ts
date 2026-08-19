import path from 'node:path'
import { formatGitCommandError } from '../project-git/git-runner.ts'
import { getBranch } from '../project-git/project-state.ts'
import { loadGitWorktrees } from '../project-git/worktrees.ts'
import { getProjectWorktree } from '../thread-state-db.ts'

export type RegisteredWorktree = {
  rootProjectId: string
  worktreePath: string
  branchName: string | null
  parentBranchName: string | null
  currentRootBranchName: string | null
}

export async function resolveRegisteredWorktree(
  projectId: string,
  worktreePath: string,
): Promise<RegisteredWorktree | { error: string }> {
  const worktrees = await loadGitWorktrees(projectId).catch((error) => ({ error }))
  if ('error' in worktrees) return { error: formatGitCommandError(worktrees.error) }
  const rootProjectId = worktrees[0]?.path ?? projectId
  const normalizedWorktreePath = path.resolve(worktreePath)
  const worktree = worktrees.find((entry) => path.resolve(entry.path) === normalizedWorktreePath)

  if (!worktree) return { error: 'Worktree is not registered with Git.' }
  if (path.resolve(worktree.path) === path.resolve(rootProjectId)) {
    return { error: 'Cannot operate on the main worktree.' }
  }

  const metadata = getProjectWorktree(worktree.path)
  if (metadata && path.resolve(metadata.rootCwd) !== path.resolve(rootProjectId)) {
    throw new Error(`Persisted worktree root does not match Git for ${worktree.path}.`)
  }

  return {
    rootProjectId,
    worktreePath: worktree.path,
    branchName: worktree.branch,
    parentBranchName: metadata?.parentBranchName?.trim() || null,
    currentRootBranchName: await getBranch(rootProjectId),
  }
}

export function getWorktreeMergeTargetError(worktree: RegisteredWorktree) {
  if (!worktree.branchName) return 'Detached worktrees cannot be merged automatically.'
  if (!worktree.currentRootBranchName) return 'The parent worktree has no active branch.'
  if (worktree.parentBranchName && worktree.currentRootBranchName !== worktree.parentBranchName) {
    return `Switch the parent worktree to ${worktree.parentBranchName} before merging.`
  }
  return null
}
