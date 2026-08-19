import type { ProjectImportCandidate } from '../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../shared/desktop-working-directory.ts'
import { setProjectImportState } from './app-settings/writers.ts'
import { getOriginUrl, isGitRepository } from './project-git/project-state.ts'
import {
  type GitWorktreeEntry,
  getMainWorktreePath,
  loadGitWorktrees,
} from './project-git/worktrees.ts'
import { withRootGitMutation } from './project-worktrees/root-git-mutation-gate.ts'
import {
  deleteProject,
  deleteProjectWorktreeMetadata,
  ensureProject,
  getProjectWorktree,
  listProjects,
  listProjectThreadIds,
  listProjectWorktreePaths,
  setProjectRepoOrigin,
  upsertProjectWorktree,
} from './thread-state-db.ts'
import { indexByWorkspaceIdentity, resolveWorkspaceIdentity } from './workspace-identity.ts'

function resolveProjectIds(projectIds: string[]) {
  if (projectIds.length > 0) {
    return [...new Set(projectIds)]
  }

  return listProjects(getDesktopWorkingDirectory()).map((project) => project.id)
}

export async function scanKnownProjects(projectIds: string[]): Promise<ProjectImportCandidate[]> {
  const knownProjects = new Map(
    listProjects(getDesktopWorkingDirectory()).map((project) => [project.id, project] as const),
  )

  return await Promise.all(
    resolveProjectIds(projectIds).map(async (projectId) => {
      const knownProject = knownProjects.get(projectId)
      const [isGitRepo, originUrl] = await Promise.all([
        isGitRepository(projectId),
        getOriginUrl(projectId),
      ])

      return {
        projectId,
        name: knownProject?.name ?? projectId,
        isGitRepo,
        hasOrigin: originUrl !== null,
        originUrl,
        alreadyImported: knownProject?.repoOriginChecked ?? false,
      } satisfies ProjectImportCandidate
    }),
  )
}

export async function importProjects(projectIds: string[]) {
  const candidates = await scanKnownProjects(projectIds)
  let repoProjectCount = 0
  let originProjectCount = 0
  let worktreeProjectCount = 0

  const worktreeCounts = await Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.isGitRepo) {
        repoProjectCount += 1
      }

      if (candidate.hasOrigin) {
        originProjectCount += 1
      }

      setProjectRepoOrigin(candidate.projectId, candidate.originUrl)
      return candidate.isGitRepo ? importProjectWorktrees(candidate.projectId) : 0
    }),
  )
  worktreeProjectCount = worktreeCounts.reduce((total, count) => total + count, 0)

  setProjectImportState(true)
  const importedProjectIds = candidates.map((candidate) => candidate.projectId)
  const importedProjectIdSet = new Set(importedProjectIds)
  const importedProjects = listProjects(getDesktopWorkingDirectory()).filter(
    (project) =>
      importedProjectIdSet.has(project.id) ||
      (project.worktree?.rootProjectId && importedProjectIdSet.has(project.worktree.rootProjectId)),
  )

  return {
    importedProjectIds,
    importedProjects,
    checkedProjectCount: candidates.length,
    repoProjectCount,
    originProjectCount,
    worktreeProjectCount,
  }
}

function removePrunableWorktreeMetadata(worktreePath: string) {
  deleteProjectWorktreeMetadata(worktreePath)
  if (listProjectThreadIds(worktreePath).length === 0) deleteProject(worktreePath)
}

async function getWorktreeImportMetadata(
  rootProjectId: string,
  rootIdentity: string,
  worktree: GitWorktreeEntry,
  existingMetadata: ReturnType<typeof getProjectWorktree>,
) {
  const isMain = worktree.path === rootProjectId
  if (
    existingMetadata &&
    (await resolveWorkspaceIdentity(existingMetadata.rootCwd)) === rootIdentity
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

async function importProjectWorktreesUnderLock(projectId: string) {
  let worktrees: GitWorktreeEntry[]
  try {
    worktrees = await loadGitWorktrees(projectId)
  } catch {
    return 0
  }
  if (worktrees.length === 0) return 0

  const rootProjectId = worktrees[0]?.path ?? projectId
  const persistedPaths = listProjectWorktreePaths(rootProjectId)
  const [rootIdentity, indexedWorktrees, persistedWorktrees] = await Promise.all([
    resolveWorkspaceIdentity(rootProjectId),
    indexByWorkspaceIdentity(worktrees, (worktree) => worktree.path),
    Promise.all(
      persistedPaths.map(async (persistedPath) => ({
        identity: await resolveWorkspaceIdentity(persistedPath),
        metadata: getProjectWorktree(persistedPath),
        persistedPath,
      })),
    ),
  ])
  const metadataByWorktreePath = new Map<
    string,
    NonNullable<ReturnType<typeof getProjectWorktree>>
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
        getProjectWorktree(worktree.path) ?? metadataByWorktreePath.get(identity) ?? null
      if (worktree.prunable) {
        return { prunableProjectId: existingMetadata?.cwd ?? worktree.path }
      }
      const { cwd, ...metadata } = await getWorktreeImportMetadata(
        rootProjectId,
        rootIdentity,
        worktree,
        existingMetadata,
      )
      return { cwd, metadata, worktree }
    }),
  )

  ensureProject(rootProjectId)
  upsertProjectWorktree({
    cwd: rootProjectId,
    rootCwd: rootProjectId,
    branchName: null,
    isMain: true,
    source: 'howcode',
  })

  let childWorktreeCount = 0
  for (const imported of imports) {
    if ('prunableProjectId' in imported) {
      removePrunableWorktreeMetadata(imported.prunableProjectId)
      continue
    }
    ensureProject(imported.cwd)
    upsertProjectWorktree({
      cwd: imported.cwd,
      rootCwd: rootProjectId,
      branchName: imported.worktree.branch,
      ...imported.metadata,
    })
    if (!imported.metadata.isMain) childWorktreeCount += 1
  }

  return childWorktreeCount
}

export async function importProjectWorktrees(projectId: string) {
  let rootProjectId: string
  try {
    rootProjectId = await getMainWorktreePath(projectId)
  } catch {
    return 0
  }
  return withRootGitMutation(rootProjectId, () => importProjectWorktreesUnderLock(rootProjectId))
}

export async function importProjectWorktreesForProjectIds(projectIds: Iterable<string>) {
  const rootProjectIds = new Set(
    [...new Set(projectIds)].map(
      (projectId) => getProjectWorktree(projectId)?.rootCwd ?? projectId,
    ),
  )
  const counts = await Promise.all([...rootProjectIds].map(importProjectWorktrees))
  return counts.reduce((total, count) => total + count, 0)
}
