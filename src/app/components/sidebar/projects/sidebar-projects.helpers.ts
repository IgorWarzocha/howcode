import type { Project } from '../../../types'

export type SidebarProjectsFilterMode = 'all' | 'favourites' | 'github' | 'terminal' | 'recent'

function projectMatchesFilter(
  project: Project,
  filterMode: SidebarProjectsFilterMode,
  terminalRunningProjectIds: ReadonlySet<string>,
  terminalRunningSessionPaths: ReadonlySet<string>,
  appLaunchedAtMs: number,
  priorityProjectIds: ReadonlySet<string>,
) {
  if (priorityProjectIds.has(project.id)) {
    return true
  }

  if (filterMode === 'github') {
    return Boolean(project.repoOriginUrl)
  }

  if (filterMode === 'favourites') {
    return Boolean(project.pinned) || project.threads.some((thread) => Boolean(thread.pinned))
  }

  if (filterMode === 'terminal') {
    if (!project.threadsLoaded) {
      return terminalRunningProjectIds.has(project.id)
    }

    return project.threads.some(
      (thread) =>
        typeof thread.sessionPath === 'string' &&
        terminalRunningSessionPaths.has(thread.sessionPath),
    )
  }

  if (filterMode === 'recent') {
    if (!project.threadsLoaded) {
      return (project.latestModifiedMs ?? 0) >= appLaunchedAtMs
    }

    return project.threads.some((thread) => (thread.lastModifiedMs ?? 0) >= appLaunchedAtMs)
  }

  return true
}

function getVisibleProjectThreads(
  project: Project,
  filterMode: SidebarProjectsFilterMode,
  terminalRunningSessionPaths: ReadonlySet<string>,
  appLaunchedAtMs: number,
) {
  if (filterMode === 'terminal') {
    return project.threads.filter(
      (thread) =>
        typeof thread.sessionPath === 'string' &&
        terminalRunningSessionPaths.has(thread.sessionPath),
    )
  }

  if (filterMode === 'recent') {
    return project.threads.filter((thread) => (thread.lastModifiedMs ?? 0) >= appLaunchedAtMs)
  }

  if (filterMode !== 'favourites' || project.pinned) {
    return project.threads
  }

  return project.threads.filter((thread) => Boolean(thread.pinned))
}

function getVisibleProjectThreadCount(
  project: Project,
  visibleThreads: Project['threads'],
  filterMode: SidebarProjectsFilterMode,
) {
  if (!project.threadsLoaded && filterMode !== 'favourites') {
    return project.threadCount ?? visibleThreads.length
  }

  if (!project.threadsLoaded && filterMode === 'favourites' && project.pinned) {
    return project.threadCount ?? visibleThreads.length
  }

  return visibleThreads.length
}

export function getSidebarVisibleProjects(input: {
  projects: Project[]
  searchQuery: string
  filterMode: SidebarProjectsFilterMode
  terminalRunningProjectIds: ReadonlySet<string>
  terminalRunningSessionPaths: ReadonlySet<string>
  appLaunchedAtMs: number
  priorityProjectIds?: readonly string[]
}) {
  const normalizedQuery = input.searchQuery.trim().toLowerCase()
  const autoExpandedProjectIds = new Set<string>()
  const priorityProjectIds = new Set(input.priorityProjectIds ?? [])

  const projects = input.projects.flatMap((project) => {
    if (
      !projectMatchesFilter(
        project,
        input.filterMode,
        input.terminalRunningProjectIds,
        input.terminalRunningSessionPaths,
        input.appLaunchedAtMs,
        priorityProjectIds,
      )
    ) {
      return []
    }

    const visibleThreads = getVisibleProjectThreads(
      project,
      input.filterMode,
      input.terminalRunningSessionPaths,
      input.appLaunchedAtMs,
    )

    if (!normalizedQuery) {
      return [
        {
          ...project,
          threads: visibleThreads,
          threadCount: getVisibleProjectThreadCount(project, visibleThreads, input.filterMode),
        },
      ]
    }

    const projectMatchesQuery = project.name.toLowerCase().includes(normalizedQuery)
    const matchingThreads = visibleThreads.filter((thread) =>
      thread.title.toLowerCase().includes(normalizedQuery),
    )

    if (
      !(priorityProjectIds.has(project.id) || projectMatchesQuery) &&
      matchingThreads.length === 0
    ) {
      return []
    }

    autoExpandedProjectIds.add(project.id)

    return [
      {
        ...project,
        threads: projectMatchesQuery ? visibleThreads : matchingThreads,
        threadCount: projectMatchesQuery
          ? getVisibleProjectThreadCount(project, visibleThreads, input.filterMode)
          : matchingThreads.length,
        threadsLoaded: project.threadsLoaded || matchingThreads.length > 0,
      },
    ]
  })

  projects.sort((left, right) => {
    const leftPriority = input.priorityProjectIds?.indexOf(left.id) ?? -1
    const rightPriority = input.priorityProjectIds?.indexOf(right.id) ?? -1

    if (leftPriority === -1 && rightPriority === -1) {
      return 0
    }

    if (leftPriority === -1) {
      return 1
    }

    if (rightPriority === -1) {
      return -1
    }

    return leftPriority - rightPriority
  })

  return {
    projects,
    autoExpandedProjectIds,
  }
}
