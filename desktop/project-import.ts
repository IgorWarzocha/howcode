import path from 'node:path'
import type { ProjectImportCandidate } from '../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../shared/desktop-working-directory.ts'
import { setProjectImportState } from './app-settings/writers.ts'
import { getOriginUrl, isGitRepository } from './project-git/project-state.ts'
import { type GitWorktreeEntry, loadGitWorktrees } from './project-git/worktrees.ts'
import {
  ensureProject,
  getProjectWorktreeDirectory,
  listProjects,
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

  for (const candidate of candidates) {
    if (candidate.isGitRepo) {
      repoProjectCount += 1
    }

    if (candidate.hasOrigin) {
      originProjectCount += 1
    }

    setProjectRepoOrigin(candidate.projectId, candidate.originUrl)
    if (candidate.isGitRepo) {
      worktreeProjectCount += await importProjectWorktrees(candidate.projectId)
    }
  }

  setProjectImportState(true)

  return {
    importedProjectIds: candidates.map((candidate) => candidate.projectId),
    checkedProjectCount: candidates.length,
    repoProjectCount,
    originProjectCount,
    worktreeProjectCount,
  }
}

function normalizePathForPrefix(projectPath: string) {
  return projectPath.endsWith('/') ? projectPath : `${projectPath}/`
}

async function importProjectWorktrees(projectId: string) {
  let worktrees: GitWorktreeEntry[]
  try {
    worktrees = await loadGitWorktrees(projectId)
  } catch {
    return 0
  }
  if (worktrees.length === 0) return 0

  const rootProjectId = worktrees[0]?.path ?? projectId
  const configuredWorktreeDir = getProjectWorktreeDirectory(rootProjectId)
  const configuredWorktreeRoot = path.isAbsolute(configuredWorktreeDir)
    ? path.resolve(configuredWorktreeDir)
    : path.resolve(rootProjectId, configuredWorktreeDir)
  const normalizedConfiguredRoot = normalizePathForPrefix(configuredWorktreeRoot)
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
    ensureProject(worktree.path)
    const isMain = worktree.path === rootProjectId
    const source = isMain
      ? 'howcode'
      : normalizePathForPrefix(worktree.path).startsWith(normalizedConfiguredRoot)
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
