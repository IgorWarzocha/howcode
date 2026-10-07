import path from 'node:path'
import {
  enrichProjectsWithResolvedIds,
  resolveProjectPathForComparison,
} from '../pi-threads/project-paths.ts'
import { importProjects } from '../project-import.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { ensureProject, listProjects } from '../thread-state-db.ts'

let startupProjectMetadataRefresh: Promise<unknown> | null = null

function getProjectNameQualifier(projectId: string) {
  const parentName = path.basename(path.dirname(projectId))
  return parentName || path.dirname(projectId) || projectId
}

function disambiguateDuplicateProjectNames<Project extends { id: string; name: string }>(
  projects: Project[],
) {
  const projectsByName = new Map<string, Project[]>()
  for (const project of projects) {
    const normalizedName = project.name.trim().toLowerCase()
    projectsByName.set(normalizedName, [...(projectsByName.get(normalizedName) ?? []), project])
  }
  return projects.map((project) => {
    const duplicates = projectsByName.get(project.name.trim().toLowerCase())
    return !duplicates || duplicates.length <= 1
      ? project
      : { ...project, name: `${project.name} · ${getProjectNameQualifier(project.id)}` }
  })
}

/** Coding owns project discovery. Merely loading the chat shell must not start it. */
export async function loadCodingShell(cwd: string) {
  ensureProject(cwd)
  if (!startupProjectMetadataRefresh) {
    startupProjectMetadataRefresh = importProjects([])
      .then(() => emitDesktopEvent({ type: 'shell-state-refresh' }))
      .catch((error) => {
        startupProjectMetadataRefresh = null
        console.warn('Failed to refresh project metadata.', error)
      })
  }
  const [resolvedCwd, projects] = await Promise.all([
    resolveProjectPathForComparison(cwd),
    enrichProjectsWithResolvedIds(listProjects(cwd)),
  ])
  return {
    resolvedCwd,
    projects: disambiguateDuplicateProjectNames(
      projects.filter((project) => project.id.trim().length > 0 && project.name.trim().length > 0),
    ),
  }
}
