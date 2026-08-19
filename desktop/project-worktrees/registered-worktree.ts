import path from 'node:path'
import { formatGitCommandError } from '../project-git/git-runner.ts'
import { getActiveBranch } from '../project-git/project-state.ts'
import { loadGitWorktrees } from '../project-git/worktrees.ts'
import { getProjectWorktree, type StoredProjectWorktree } from '../thread-state-db.ts'

export type RegisteredWorktree = {
  rootProjectId: string
  worktreePath: string
  branchName: string | null
  parentBranchName: string | null
  currentRootBranchName: string | null
  metadata: StoredProjectWorktree | null
}

type ResolveRegisteredWorktreesOptions = {
  skipMissing?: boolean
}

export async function resolveRegisteredWorktrees(
  projectId: string,
  worktreePaths: string[],
  options: ResolveRegisteredWorktreesOptions = {},
): Promise<RegisteredWorktree[] | { error: string; failedWorktreePath?: string }> {
  const worktrees = await loadGitWorktrees(projectId).catch((error) => ({ error }))
  if ('error' in worktrees) return { error: formatGitCommandError(worktrees.error) }

  const rootProjectId = worktrees[0]?.path ?? projectId
  const normalizedRootProjectId = path.resolve(rootProjectId)
  const currentRootBranchName = await getActiveBranch(rootProjectId)
  const resolved: RegisteredWorktree[] = []
  const worktreeByPath = new Map(
    worktrees.map((worktree) => [path.resolve(worktree.path), worktree]),
  )
  const normalizedWorktreePaths = new Set(
    worktreePaths.map((worktreePath) => path.resolve(worktreePath)),
  )

  for (const normalizedWorktreePath of normalizedWorktreePaths) {
    const worktree = worktreeByPath.get(normalizedWorktreePath)

    if (!worktree) {
      if (options.skipMissing) continue
      return {
        error: 'Worktree is not registered with Git.',
        failedWorktreePath: normalizedWorktreePath,
      }
    }
    if (path.resolve(worktree.path) === normalizedRootProjectId) {
      return { error: 'Cannot operate on the main worktree.', failedWorktreePath: worktree.path }
    }

    const metadata = getProjectWorktree(worktree.path)
    if (metadata && path.resolve(metadata.rootCwd) !== normalizedRootProjectId) {
      throw new Error(`Persisted worktree root does not match Git for ${worktree.path}.`)
    }

    resolved.push({
      rootProjectId,
      worktreePath: worktree.path,
      branchName: worktree.branch,
      parentBranchName: metadata?.parentBranchName?.trim() || null,
      currentRootBranchName,
      metadata,
    })
  }

  return resolved
}

export async function resolveRegisteredWorktree(
  projectId: string,
  worktreePath: string,
): Promise<RegisteredWorktree | { error: string }> {
  const resolved = await resolveRegisteredWorktrees(projectId, [worktreePath])
  if ('error' in resolved) return resolved
  return resolved[0] ?? { error: 'Worktree is not registered with Git.' }
}

export function getWorktreeMergeTargetError(worktree: RegisteredWorktree) {
  if (!worktree.branchName) return 'Detached worktrees cannot be merged automatically.'
  if (worktree.metadata?.source === 'howcode' && !worktree.parentBranchName) {
    return 'Managed worktrees require a recorded parent branch before merging.'
  }
  if (!worktree.currentRootBranchName) return 'The parent worktree has no active branch.'
  if (worktree.parentBranchName && worktree.currentRootBranchName !== worktree.parentBranchName) {
    return `Switch the parent worktree to ${worktree.parentBranchName} before merging.`
  }
  return null
}
