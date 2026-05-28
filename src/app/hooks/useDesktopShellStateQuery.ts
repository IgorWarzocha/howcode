import { Debouncer } from '@tanstack/react-pacer'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import type { ShellState } from '../desktop/types'
import { desktopQueryKeys, getShellStateQuery } from '../query/desktop-query'
import type { Project } from '../types'

function sameProjectWorktree(left: Project['worktree'], right: Project['worktree']) {
  if (left === right) return true
  if (!(left && right)) return false
  return (
    left.rootProjectId === right.rootProjectId &&
    left.branchName === right.branchName &&
    left.parentBranchName === right.parentBranchName &&
    left.isMain === right.isMain &&
    left.source === right.source &&
    left.completed === right.completed
  )
}

function sameProjectForShellRefresh(left: Project, right: Project) {
  return (
    left.id === right.id &&
    left.resolvedId === right.resolvedId &&
    left.name === right.name &&
    left.threads === right.threads &&
    left.latestModifiedMs === right.latestModifiedMs &&
    left.pinned === right.pinned &&
    left.collapsed === right.collapsed &&
    left.threadsLoaded === right.threadsLoaded &&
    left.threadsScope === right.threadsScope &&
    left.threadCount === right.threadCount &&
    left.repoOriginUrl === right.repoOriginUrl &&
    left.repoOriginChecked === right.repoOriginChecked &&
    left.worktreeDirectory === right.worktreeDirectory &&
    sameProjectWorktree(left.worktree, right.worktree)
  )
}

function preserveProjectReference(currentProject: Project | undefined, nextProject: Project) {
  return currentProject && sameProjectForShellRefresh(currentProject, nextProject)
    ? currentProject
    : nextProject
}

export function mergeShellStateProjects(
  currentState: ShellState | null | undefined,
  nextState: ShellState | null,
): ShellState | null {
  if (!nextState) return null
  if (!currentState) return nextState

  const currentProjectsById = new Map(
    currentState.projects.map((project) => [project.id, project] as const),
  )
  let reusedProjectCount = 0
  const projects = nextState.projects.map((project) => {
    const currentProject = currentProjectsById.get(project.id)
    if (!currentProject?.threadsLoaded || project.threadsLoaded) {
      const nextProject = preserveProjectReference(currentProject, project)
      if (nextProject === currentProject) reusedProjectCount += 1
      return nextProject
    }
    const nextProject = preserveProjectReference(currentProject, {
      ...project,
      threads: currentProject.threads,
      threadCount: Math.max(project.threadCount ?? 0, currentProject.threads.length),
      latestModifiedMs: Math.max(
        project.latestModifiedMs ?? 0,
        currentProject.latestModifiedMs ?? 0,
      ),
      threadsLoaded: true,
      threadsScope: currentProject.threadsScope,
    })
    if (nextProject === currentProject) reusedProjectCount += 1
    return nextProject
  })
  return {
    ...nextState,
    projects: reusedProjectCount === projects.length ? currentState.projects : projects,
  }
}

export function useDesktopShellStateQuery() {
  const queryClient = useQueryClient()
  const loadMergedShellState = useCallback(async () => {
    const nextState = await getShellStateQuery()
    const currentState = queryClient.getQueryData<ShellState | null>(desktopQueryKeys.shellState())
    return mergeShellStateProjects(currentState, nextState)
  }, [queryClient])
  const shellStateQuery = useQuery<ShellState | null>({
    queryKey: desktopQueryKeys.shellState(),
    queryFn: loadMergedShellState,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const shellRefreshDebouncer = useMemo(
    () =>
      new Debouncer(
        () => {
          void queryClient.invalidateQueries({ queryKey: desktopQueryKeys.shellState() })
        },
        { wait: 140 },
      ),
    [queryClient],
  )
  const refreshShellState = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: desktopQueryKeys.shellState(),
        queryFn: loadMergedShellState,
        staleTime: 0,
      }),
    [loadMergedShellState, queryClient],
  )
  const scheduleShellStateRefresh = useCallback(() => {
    shellRefreshDebouncer.maybeExecute()
  }, [shellRefreshDebouncer])
  useEffect(() => () => shellRefreshDebouncer.cancel(), [shellRefreshDebouncer])
  return { refreshShellState, scheduleShellStateRefresh, shellStateQuery }
}
