import type { Project } from '../../../types'

export function getProjectScopeLabel({
  selectedProject,
  visibleProjects,
}: {
  selectedProject: Project | null
  visibleProjects: readonly Project[]
}) {
  if (visibleProjects.length === 0) return 'No projects selected'
  const primaryVisibleProject =
    visibleProjects.find((project) => project.id === selectedProject?.id) ?? visibleProjects[0]
  const primaryProjectName = primaryVisibleProject?.name ?? selectedProject?.name ?? 'Projects'
  return visibleProjects.length > 1
    ? `${primaryProjectName} +${visibleProjects.length - 1}`
    : primaryProjectName
}

export function getDisplayableProjects(projects: readonly Project[]) {
  return projects.filter(
    (project) =>
      project.id.trim().length > 0 &&
      project.name.trim().length > 0 &&
      project.worktree?.isMain !== false,
  )
}

export function getDisplayableWorkspaces(projects: readonly Project[]) {
  return projects.filter(
    (project) => project.id.trim().length > 0 && project.name.trim().length > 0,
  )
}

export function getSelectedProjectForScope({
  projects,
  selectedProjectId,
  workspaces,
}: {
  projects: readonly Project[]
  selectedProjectId: string
  workspaces: readonly Project[]
}) {
  const selectedWorkspace = workspaces.find((project) => project.id === selectedProjectId)
  return (
    projects.find((project) => project.id === selectedProjectId) ??
    projects.find((project) => project.id === selectedWorkspace?.worktree?.rootProjectId) ??
    projects[0] ??
    null
  )
}

export function filterVisibleProjectIds(
  configuredProjectIds: string[] | null | undefined,
  projects: readonly Project[],
) {
  if (!configuredProjectIds) return configuredProjectIds
  const validProjectIds = new Set(projects.map((project) => project.id))
  return configuredProjectIds.filter((projectId) => validProjectIds.has(projectId))
}

export function toggleVisibleProjectId(projectId: string, visibleProjectIds: readonly string[]) {
  const wasVisible = visibleProjectIds.includes(projectId)
  const nextProjectIds = wasVisible
    ? visibleProjectIds.filter((id) => id !== projectId)
    : [...visibleProjectIds, projectId]
  return {
    nextProjectIds,
    shouldFocusProject: !wasVisible && visibleProjectIds.length === 0,
    shouldShowLanding: nextProjectIds.length === 0,
  }
}

export function orderProjectsForScopeSelector(
  projects: readonly Project[],
  visibleProjectIds: string[],
) {
  const visibleIndexById = new Map(visibleProjectIds.map((projectId, index) => [projectId, index]))
  return projects.toSorted((left, right) => {
    const leftIndex = visibleIndexById.get(left.id)
    const rightIndex = visibleIndexById.get(right.id)
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex
    if (leftIndex !== undefined) return -1
    if (rightIndex !== undefined) return 1
    return 0
  })
}

export function getVisibleProjectIds(
  storedVisibleProjectIds: string[] | null,
  initialVisibleProjectIds: string[] | null | undefined,
  selectedProject: Project | null,
) {
  if (storedVisibleProjectIds) return storedVisibleProjectIds
  if (initialVisibleProjectIds) return initialVisibleProjectIds
  if (storedVisibleProjectIds === null && initialVisibleProjectIds === null) {
    return selectedProject ? [selectedProject.id] : []
  }
  return []
}
