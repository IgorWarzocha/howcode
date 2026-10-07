import { useQuery } from '@tanstack/react-query'
import type {
  DesktopActionInvoker,
  ProjectGitState,
  ProjectUsageSummary,
} from '../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'
import type { Project } from '../../../../src/app/types'
import { getProjectGitStateQuery, getProjectUsageSummaryQuery } from '../query'
import { ProjectOverview } from './landing-view-parts'

type ProjectOverviewViewProps = {
  composerOverlayHeight: number
  project: Project
  onOpenThread: (projectId: string, threadId: string, conversationId: string) => void
  onAction: DesktopActionInvoker
}

export function ProjectOverviewView({
  composerOverlayHeight,
  project,
  onOpenThread,
  onAction,
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
      onAction={onAction}
    />
  )
}
