import { useQuery } from '@tanstack/react-query'
import type { ProjectGitState, ProjectUsageSummary } from '../desktop/types'
import {
  desktopQueryKeys,
  getProjectGitStateQuery,
  getProjectUsageSummaryQuery,
} from '../query/desktop-query'
import type { Project } from '../types'
import { ProjectOverview } from './landing-view-parts'

type ProjectOverviewViewProps = {
  composerOverlayHeight: number
  project: Project
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
}

export function ProjectOverviewView({
  composerOverlayHeight,
  project,
  onOpenThread,
}: ProjectOverviewViewProps) {
  const projectUsageQuery = useQuery<ProjectUsageSummary | null>({
    queryKey: desktopQueryKeys.projectUsageSummary(project.id),
    queryFn: () => getProjectUsageSummaryQuery(project.id),
    refetchInterval: (query) => (query.state.data?.archivedUsageRefreshing ? 5000 : false),
  })
  const projectGitQuery = useQuery<ProjectGitState | null>({
    queryKey: desktopQueryKeys.projectGitState(project.id),
    queryFn: () => getProjectGitStateQuery(project.id),
  })

  return (
    <ProjectOverview
      composerOverlayHeight={composerOverlayHeight}
      project={project}
      gitState={projectGitQuery.data}
      usageLoading={projectUsageQuery.isLoading}
      usageSummary={projectUsageQuery.data}
      onOpenThread={onOpenThread}
    />
  )
}
