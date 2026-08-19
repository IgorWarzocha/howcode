import { formatGitCommandError } from '../project-git/git-runner.ts'
import { getActiveBranch } from '../project-git/project-state.ts'
import { type GitWorktreeEntry, loadGitWorktrees } from '../project-git/worktrees.ts'
import {
  getProjectWorktree,
  listProjectWorktreePaths,
  type StoredProjectWorktree,
} from '../thread-state-db.ts'
import { indexByWorkspaceIdentity, resolveWorkspaceIdentity } from '../workspace-identity.ts'

export type RegisteredWorktree = {
  rootProjectId: string
  projectId: string
  worktreePath: string
  branchName: string | null
  parentBranchName: string | null
  currentRootBranchName: string | null
  metadata: StoredProjectWorktree | null
}

type ResolveRegisteredWorktreesOptions = {
  skipMissing?: boolean
}

type WorktreeResolutionError = { error: string; failedWorktreePath?: string }

async function indexStoredMetadata(rootProjectId: string) {
  const metadataByPath = new Map<string, StoredProjectWorktree>()
  const entries = await Promise.all(
    listProjectWorktreePaths(rootProjectId).map(async (persistedPath) => ({
      identity: await resolveWorkspaceIdentity(persistedPath),
      metadata: getProjectWorktree(persistedPath),
    })),
  )
  for (const { identity, metadata } of entries) {
    if (!metadata) continue
    const existing = metadataByPath.get(identity)
    if (existing && existing.cwd !== metadata.cwd) {
      throw new Error(`Multiple persisted worktrees resolve to ${identity}.`)
    }
    metadataByPath.set(identity, metadata)
  }
  return metadataByPath
}

type WorktreeResolutionContext = {
  currentRootBranchName: string | null
  metadataByPath: Map<string, StoredProjectWorktree>
  rootIdentity: string
  rootProjectId: string
  skipMissing: boolean
  worktreeByPath: Map<string, GitWorktreeEntry>
}

async function resolveRequestedWorktree(
  context: WorktreeResolutionContext,
  worktreeIdentity: string,
  requestedWorktreePath: string,
): Promise<RegisteredWorktree | WorktreeResolutionError | null> {
  const worktree = context.worktreeByPath.get(worktreeIdentity)
  if (!worktree) {
    return context.skipMissing
      ? null
      : {
          error: 'Worktree is not registered with Git.',
          failedWorktreePath: requestedWorktreePath,
        }
  }
  if (worktreeIdentity === context.rootIdentity) {
    return {
      error: 'Cannot operate on the main worktree.',
      failedWorktreePath: worktree.path,
    }
  }

  let metadata: StoredProjectWorktree | null
  try {
    metadata =
      getProjectWorktree(worktree.path) ?? context.metadataByPath.get(worktreeIdentity) ?? null
  } catch (error) {
    return { error: formatGitCommandError(error), failedWorktreePath: worktree.path }
  }
  if (metadata && (await resolveWorkspaceIdentity(metadata.rootCwd)) !== context.rootIdentity) {
    return {
      error: `Persisted worktree root does not match Git for ${worktree.path}.`,
      failedWorktreePath: worktree.path,
    }
  }

  return {
    rootProjectId: context.rootProjectId,
    projectId: metadata?.cwd ?? worktree.path,
    worktreePath: worktree.path,
    branchName: worktree.branch,
    parentBranchName: metadata?.parentBranchName?.trim() || null,
    currentRootBranchName: context.currentRootBranchName,
    metadata,
  }
}

export async function resolveRegisteredWorktrees(
  projectId: string,
  worktreePaths: string[],
  options: ResolveRegisteredWorktreesOptions = {},
): Promise<RegisteredWorktree[] | { error: string; failedWorktreePath?: string }> {
  const worktrees = await loadGitWorktrees(projectId).catch((error) => ({ error }))
  if ('error' in worktrees) return { error: formatGitCommandError(worktrees.error) }

  const rootProjectId = worktrees[0]?.path ?? projectId
  const metadataPromise = indexStoredMetadata(rootProjectId)
    .then((metadataByPath) => ({ metadataByPath }))
    .catch((error) => ({ error }))
  const [rootIdentity, currentRootBranchName, worktreeByPath, requestedWorktreePaths, metadata] =
    await Promise.all([
      resolveWorkspaceIdentity(rootProjectId),
      getActiveBranch(rootProjectId),
      indexByWorkspaceIdentity(worktrees, (worktree) => worktree.path),
      indexByWorkspaceIdentity(worktreePaths, (worktreePath) => worktreePath),
      metadataPromise,
    ])
  if ('error' in metadata) return { error: formatGitCommandError(metadata.error) }
  const context: WorktreeResolutionContext = {
    rootProjectId,
    rootIdentity,
    currentRootBranchName,
    worktreeByPath,
    metadataByPath: metadata.metadataByPath,
    skipMissing: options.skipMissing === true,
  }
  const results = await Promise.all(
    [...requestedWorktreePaths].map(([worktreeIdentity, requestedWorktreePath]) =>
      resolveRequestedWorktree(context, worktreeIdentity, requestedWorktreePath),
    ),
  )

  const resolved: RegisteredWorktree[] = []
  for (const result of results) {
    if (!result) continue
    if ('error' in result) return result
    resolved.push(result)
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
