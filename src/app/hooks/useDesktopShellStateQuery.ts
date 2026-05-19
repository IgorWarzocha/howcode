import { Debouncer } from '@tanstack/react-pacer'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import type { ShellState } from '../desktop/types'
import { desktopQueryKeys, getShellStateQuery } from '../query/desktop-query'

function shouldReloadLoadedProjectThreads(
  currentProject: ShellState['projects'][number],
  nextProject: ShellState['projects'][number],
) {
  if (!currentProject.threadsLoaded || nextProject.threadsLoaded) return false
  return (
    (nextProject.threadCount ?? 0) >
      (currentProject.threadCount ?? currentProject.threads.length) ||
    (nextProject.latestModifiedMs ?? 0) > (currentProject.latestModifiedMs ?? 0)
  )
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
  return {
    ...nextState,
    projects: nextState.projects.map((project) => {
      const currentProject = currentProjectsById.get(project.id)
      if (!currentProject?.threadsLoaded || project.threadsLoaded) return project
      if (shouldReloadLoadedProjectThreads(currentProject, project)) {
        return {
          ...project,
          collapsed: currentProject.collapsed ?? project.collapsed,
        }
      }
      return {
        ...project,
        threads: currentProject.threads,
        threadCount: Math.max(project.threadCount ?? 0, currentProject.threads.length),
        threadsLoaded: true,
        threadsScope: currentProject.threadsScope,
      }
    }),
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
