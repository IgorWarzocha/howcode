import { setDirectoryImportState } from '../../../desktop/app-settings/writers.ts'
import { ensureDirectory, listDirectoryChatIds } from '../../../desktop/chat-repository.ts'
import {
  indexByDirectoryIdentity,
  resolveDirectoryIdentity,
} from '../../../desktop/directory-identity.ts'
import type { DirectoryImportCandidate } from '../../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory.ts'
import { getOriginUrl, isGitRepository } from './directory-git/directory-state.ts'
import { captureGitCommonDirectoryIdentity } from './directory-git/repository-identity.ts'
import {
  type GitWorktreeEntry,
  getMainWorktreePath,
  loadGitWorktrees,
} from './directory-git/worktrees.ts'
import { withRootGitMutation } from './directory-worktrees/root-git-mutation-gate.ts'
import {
  deleteDirectory,
  deleteDirectoryWorktreeMetadata,
  getDirectoryWorktree,
  listDirectories,
  listDirectoryWorktreePaths,
  setDirectoryRepoOrigin,
  upsertDirectoryWorktree,
} from './state.ts'

function resolveDirectoryIds(directoryIds: string[]) {
  if (directoryIds.length > 0) {
    return [...new Set(directoryIds)]
  }

  return listDirectories(getDesktopWorkingDirectory()).map((directory) => directory.id)
}

export async function scanKnownDirectories(
  directoryIds: string[],
): Promise<DirectoryImportCandidate[]> {
  const knownDirectories = new Map(
    listDirectories(getDesktopWorkingDirectory()).map(
      (directory) => [directory.id, directory] as const,
    ),
  )

  return await Promise.all(
    resolveDirectoryIds(directoryIds).map(async (directoryId) => {
      const knownDirectory = knownDirectories.get(directoryId)
      const [isGitRepo, originUrl] = await Promise.all([
        isGitRepository(directoryId),
        getOriginUrl(directoryId),
      ])

      return {
        directoryId,
        name: knownDirectory?.name ?? directoryId,
        isGitRepo,
        hasOrigin: originUrl !== null,
        originUrl,
        alreadyImported: knownDirectory?.repoOriginChecked ?? false,
      } satisfies DirectoryImportCandidate
    }),
  )
}

export async function importDirectories(directoryIds: string[]) {
  const candidates = await scanKnownDirectories(directoryIds)
  let repoDirectoryCount = 0
  let originDirectoryCount = 0
  let worktreeDirectoryCount = 0

  const worktreeCounts = await Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.isGitRepo) {
        repoDirectoryCount += 1
      }

      if (candidate.hasOrigin) {
        originDirectoryCount += 1
      }

      setDirectoryRepoOrigin(candidate.directoryId, candidate.originUrl)
      return candidate.isGitRepo ? importDirectoryWorktrees(candidate.directoryId) : 0
    }),
  )
  worktreeDirectoryCount = worktreeCounts.reduce((total, count) => total + count, 0)

  setDirectoryImportState(true)
  const importedDirectoryIds = candidates.map((candidate) => candidate.directoryId)
  const importedDirectoryIdSet = new Set(importedDirectoryIds)
  const importedDirectories = listDirectories(getDesktopWorkingDirectory()).filter(
    (directory) =>
      importedDirectoryIdSet.has(directory.id) ||
      (directory.worktree?.rootDirectoryId &&
        importedDirectoryIdSet.has(directory.worktree.rootDirectoryId)),
  )

  return {
    importedDirectoryIds,
    importedDirectories,
    checkedDirectoryCount: candidates.length,
    repoDirectoryCount,
    originDirectoryCount,
    worktreeDirectoryCount,
  }
}

function removePrunableWorktreeMetadata(worktreePath: string) {
  deleteDirectoryWorktreeMetadata(worktreePath)
  if (listDirectoryChatIds(worktreePath).length === 0) deleteDirectory(worktreePath)
}

async function getWorktreeImportMetadata(
  rootDirectoryId: string,
  rootIdentity: string,
  worktree: GitWorktreeEntry,
  existingMetadata: ReturnType<typeof getDirectoryWorktree>,
) {
  const isMain = worktree.path === rootDirectoryId
  if (
    existingMetadata &&
    (await resolveDirectoryIdentity(existingMetadata.rootCwd)) === rootIdentity
  ) {
    return {
      cwd: existingMetadata.cwd,
      isMain,
      parentBranchName: existingMetadata.parentBranchName,
      source: isMain ? ('howcode' as const) : existingMetadata.source,
    }
  }

  return {
    cwd: worktree.path,
    isMain,
    parentBranchName: null,
    source: isMain ? ('howcode' as const) : ('imported' as const),
  }
}

async function importDirectoryWorktreesUnderLock(directoryId: string) {
  let worktrees: GitWorktreeEntry[]
  try {
    worktrees = await loadGitWorktrees(directoryId)
  } catch {
    return 0
  }
  if (worktrees.length === 0) return 0

  const rootDirectoryId = worktrees[0]?.path ?? directoryId
  const gitCommonDirectoryIdentity = await captureGitCommonDirectoryIdentity(rootDirectoryId)
  const persistedPaths = listDirectoryWorktreePaths(rootDirectoryId)
  const [rootIdentity, indexedWorktrees, persistedWorktrees] = await Promise.all([
    resolveDirectoryIdentity(rootDirectoryId),
    indexByDirectoryIdentity(worktrees, (worktree) => worktree.path),
    Promise.all(
      persistedPaths.map(async (persistedPath) => ({
        identity: await resolveDirectoryIdentity(persistedPath),
        metadata: getDirectoryWorktree(persistedPath),
        persistedPath,
      })),
    ),
  ])
  const metadataByWorktreePath = new Map<
    string,
    NonNullable<ReturnType<typeof getDirectoryWorktree>>
  >()
  for (const { identity, metadata, persistedPath } of persistedWorktrees) {
    if (metadata) metadataByWorktreePath.set(identity, metadata)
    if (!indexedWorktrees.has(identity)) {
      removePrunableWorktreeMetadata(persistedPath)
    }
  }

  const imports = await Promise.all(
    [...indexedWorktrees].map(async ([identity, worktree]) => {
      const existingMetadata =
        getDirectoryWorktree(worktree.path) ?? metadataByWorktreePath.get(identity) ?? null
      if (worktree.prunable) {
        return { prunableDirectoryId: existingMetadata?.cwd ?? worktree.path }
      }
      const { cwd, ...metadata } = await getWorktreeImportMetadata(
        rootDirectoryId,
        rootIdentity,
        worktree,
        existingMetadata,
      )
      return { cwd, metadata, worktree }
    }),
  )

  ensureDirectory(rootDirectoryId)
  upsertDirectoryWorktree({
    cwd: rootDirectoryId,
    rootCwd: rootDirectoryId,
    branchName: null,
    gitCommonDirectoryIdentity,
    isMain: true,
    source: 'howcode',
  })

  let childWorktreeCount = 0
  for (const imported of imports) {
    if ('prunableDirectoryId' in imported) {
      removePrunableWorktreeMetadata(imported.prunableDirectoryId)
      continue
    }
    ensureDirectory(imported.cwd)
    upsertDirectoryWorktree({
      cwd: imported.cwd,
      rootCwd: rootDirectoryId,
      branchName: imported.worktree.branch,
      gitCommonDirectoryIdentity,
      ...imported.metadata,
    })
    if (!imported.metadata.isMain) childWorktreeCount += 1
  }

  return childWorktreeCount
}

export async function importDirectoryWorktrees(directoryId: string) {
  let rootDirectoryId: string
  try {
    rootDirectoryId = await getMainWorktreePath(directoryId)
  } catch {
    return 0
  }
  return withRootGitMutation(rootDirectoryId, () =>
    importDirectoryWorktreesUnderLock(rootDirectoryId),
  )
}

export async function importDirectoryWorktreesForDirectoryIds(directoryIds: Iterable<string>) {
  const rootDirectoryIds = new Set(
    [...new Set(directoryIds)].map(
      (directoryId) => getDirectoryWorktree(directoryId)?.rootCwd ?? directoryId,
    ),
  )
  const counts = await Promise.all([...rootDirectoryIds].map(importDirectoryWorktrees))
  return counts.reduce((total, count) => total + count, 0)
}
