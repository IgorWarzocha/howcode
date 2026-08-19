import path from 'node:path'
import type { ProjectImportCandidate } from '../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../shared/desktop-working-directory.ts'
import { setProjectImportState } from './app-settings/writers.ts'
import { getOriginUrl, isGitRepository } from './project-git/project-state.ts'
import { type GitWorktreeEntry, loadGitWorktrees } from './project-git/worktrees.ts'
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

export async function importProjectWorktrees(projectId: string) {
  let worktrees: GitWorktreeEntry[]
  try {
    worktrees = await loadGitWorktrees(projectId)
  } catch {
    return 0
  }
  if (worktrees.length === 0) return 0

  const rootProjectId = worktrees[0]?.path ?? projectId
  const registeredWorktreePaths = new Set(worktrees.map((worktree) => path.resolve(worktree.path)))
  for (const persistedPath of listProjectWorktreePaths(rootProjectId)) {
    if (!registeredWorktreePaths.has(path.resolve(persistedPath))) {
      removePrunableWorktreeMetadata(persistedPath)
    }
  }
  let childWorktreeCount = 0

  ensureProject(rootProjectId)
  upsertProjectWorktree({
    cwd: rootProjectId,
    rootCwd: rootProjectId,
    branchName: null,
    isMain: true,
    source: 'howcode',
  })

  for (const worktree of worktrees) {
    if (worktree.prunable) {
      removePrunableWorktreeMetadata(worktree.path)
      continue
    }
    ensureProject(worktree.path)
    const isMain = worktree.path === rootProjectId
    const existingMetadata = getProjectWorktree(worktree.path)
    const source =
      isMain || (existingMetadata?.source === 'howcode' && existingMetadata.parentBranchName)
        ? 'howcode'
        : 'imported'
    upsertProjectWorktree({
      cwd: worktree.path,
      rootCwd: rootProjectId,
      branchName: worktree.branch,
      isMain,
      source,
    })
    if (!isMain) childWorktreeCount += 1
  }

  return childWorktreeCount
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
