import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ProjectGitState } from '../../../desktop/types'
import { desktopQueryKeys, getProjectGitStateQuery } from '../../../query/desktop-query'
import type { Project } from '../../../types'

export function useProjectGitStates(
  visibleProjects: readonly Project[],
  projectGitState: ProjectGitState | null,
) {
  const gitStateQueries = useQueries({
    queries: visibleProjects.map((project) => ({
      queryKey: desktopQueryKeys.projectGitState(project.id),
      queryFn: () => getProjectGitStateQuery(project.id),
      staleTime: 0,
    })),
  })

  return useMemo(() => {
    const states = new Map<string, ProjectGitState | null>()
    for (const [index, project] of visibleProjects.entries()) {
      states.set(project.id, gitStateQueries[index]?.data ?? null)
    }
    if (projectGitState) states.set(projectGitState.projectId, projectGitState)
    return states
  }, [gitStateQueries, projectGitState, visibleProjects])
}
