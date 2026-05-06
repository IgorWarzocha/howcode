import path from 'node:path'
import type { ShellState } from '../../shared/desktop-contracts.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import { getComposerState } from '../pi-desktop-runtime.ts'
import { loadPiSettings, loadPiThemeState } from '../pi-settings.ts'
import { invokeRuntimeHost } from '../runtime-host/client-bridge.ts'
import { ensureProject, listProjects } from '../thread-state-db.ts'
import { enrichProjectsWithResolvedIds, resolveProjectPathForComparison } from './project-paths.ts'
import { scheduleShellIndexSync } from './shell-index.ts'

type SessionStorage = { agentDir: string; sessionDir: string }

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
    const duplicateProjects = projectsByName.get(project.name.trim().toLowerCase())
    if (!duplicateProjects || duplicateProjects.length <= 1) {
      return project
    }

    return {
      ...project,
      name: `${project.name} · ${getProjectNameQualifier(project.id)}`,
    }
  })
}

function getSessionStorage(cwd: string): Promise<SessionStorage> {
  return invokeRuntimeHost('getPiSessionStorage', { projectPath: cwd })
}

export async function loadShellState(cwd: string): Promise<ShellState> {
  const { agentDir, sessionDir } = await getSessionStorage(cwd)

  ensureProject(cwd)
  scheduleShellIndexSync(cwd)
  const composer = await getComposerState({ projectId: cwd })
  const appSettings = loadAppSettings()
  const [piSettings, piTheme, resolvedCwd, projects] = await Promise.all([
    loadPiSettings(cwd),
    loadPiThemeState(cwd),
    resolveProjectPathForComparison(cwd),
    enrichProjectsWithResolvedIds(listProjects(cwd)),
  ])
  const visibleProjects = disambiguateDuplicateProjectNames(projects)

  return {
    platform: process.platform,
    mockMode: false,
    productName: 'howcode',
    cwd,
    resolvedCwd,
    agentDir,
    sessionDir,
    appSettings,
    piSettings,
    piTheme,
    composer,
    projects: visibleProjects,
  }
}
