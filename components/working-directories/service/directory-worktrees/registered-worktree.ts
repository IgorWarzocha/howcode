import {
  formatGitCommandError,
  type GitWorktreeEntry,
  getActiveBranch,
  loadGitWorktrees,
} from '@howaboua/howcode-git/service'
import {
  indexByDirectoryIdentity,
  resolveDirectoryIdentity,
} from '@howaboua/howcode-sdk/node/directory-identity'
import {
  getDirectoryWorktree,
  listDirectoryWorktreePaths,
  type StoredDirectoryWorktree,
} from '../state.ts'

export type RegisteredWorktree = {
  rootDirectoryId: string
  directoryId: string
  worktreePath: string
  branchName: string | null
  parentBranchName: string | null
  currentRootBranchName: string | null
  metadata: StoredDirectoryWorktree | null
}

type ResolveRegisteredWorktreesOptions = {
  skipMissing?: boolean
}

type WorktreeResolutionError = { error: string; failedWorktreePath?: string }

async function indexStoredMetadata(rootDirectoryId: string) {
  const metadataByPath = new Map<string, StoredDirectoryWorktree>()
  const entries = await Promise.all(
    listDirectoryWorktreePaths(rootDirectoryId).map(async (persistedPath) => ({
      identity: await resolveDirectoryIdentity(persistedPath),
      metadata: getDirectoryWorktree(persistedPath),
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
  metadataByPath: Map<string, StoredDirectoryWorktree>
  rootIdentity: string
  rootDirectoryId: string
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

  let metadata: StoredDirectoryWorktree | null
  try {
    metadata =
      getDirectoryWorktree(worktree.path) ?? context.metadataByPath.get(worktreeIdentity) ?? null
  } catch (error) {
    return { error: formatGitCommandError(error), failedWorktreePath: worktree.path }
  }
  if (metadata && (await resolveDirectoryIdentity(metadata.rootCwd)) !== context.rootIdentity) {
    return {
      error: `Persisted worktree root does not match Git for ${worktree.path}.`,
      failedWorktreePath: worktree.path,
    }
  }

  return {
    rootDirectoryId: context.rootDirectoryId,
    directoryId: metadata?.cwd ?? worktree.path,
    worktreePath: worktree.path,
    branchName: worktree.branch,
    parentBranchName: metadata?.parentBranchName?.trim() || null,
    currentRootBranchName: context.currentRootBranchName,
    metadata,
  }
}

export async function resolveRegisteredWorktrees(
  directoryId: string,
  worktreePaths: string[],
  options: ResolveRegisteredWorktreesOptions = {},
): Promise<RegisteredWorktree[] | { error: string; failedWorktreePath?: string }> {
  const worktrees = await loadGitWorktrees(directoryId).catch((error) => ({ error }))
  if ('error' in worktrees) return { error: formatGitCommandError(worktrees.error) }

  const rootDirectoryId = worktrees[0]?.path ?? directoryId
  const metadataPromise = indexStoredMetadata(rootDirectoryId)
    .then((metadataByPath) => ({ metadataByPath }))
    .catch((error) => ({ error }))
  const [rootIdentity, currentRootBranchName, worktreeByPath, requestedWorktreePaths, metadata] =
    await Promise.all([
      resolveDirectoryIdentity(rootDirectoryId),
      getActiveBranch(rootDirectoryId),
      indexByDirectoryIdentity(worktrees, (worktree) => worktree.path),
      indexByDirectoryIdentity(worktreePaths, (worktreePath) => worktreePath),
      metadataPromise,
    ])
  if ('error' in metadata) return { error: formatGitCommandError(metadata.error) }
  const context: WorktreeResolutionContext = {
    rootDirectoryId,
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
  directoryId: string,
  worktreePath: string,
): Promise<RegisteredWorktree | { error: string }> {
  const resolved = await resolveRegisteredWorktrees(directoryId, [worktreePath])
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
