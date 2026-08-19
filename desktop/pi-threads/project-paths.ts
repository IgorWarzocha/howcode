import path from 'node:path'
import type { Project } from '../../shared/desktop-contracts.ts'
import { resolveWorkspaceIdentity } from '../workspace-identity.ts'

export async function resolveProjectPathForComparison(projectId: string) {
  return resolveWorkspaceIdentity(projectId)
}

export async function enrichProjectsWithResolvedIds(projects: Project[]) {
  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      resolvedId: await resolveProjectPathForComparison(project.id),
    })),
  )
}

export async function isProtectedProjectDeletionTarget(projectId: string, activeProjectId: string) {
  const [resolvedProjectId, resolvedActiveProjectId] = await Promise.all([
    resolveProjectPathForComparison(projectId),
    resolveProjectPathForComparison(activeProjectId),
  ])
  const relativePath = path.relative(resolvedProjectId, resolvedActiveProjectId)
  const isOutsideCandidate =
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)

  return relativePath.length === 0 || !isOutsideCandidate
}
