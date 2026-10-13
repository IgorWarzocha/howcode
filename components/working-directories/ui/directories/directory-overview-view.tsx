import { useSidebarRepositorySnapshot } from '@howaboua/howcode-sdk/sidebar-renderer'
import { getSidebarRepositoryStateQuery } from '@howcode/query/sidebar-query'
import { useQuery } from '@tanstack/react-query'
import type { DirectoryGitState, DirectoryUsageSummary } from '../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'
import type { WorkingDirectory } from '../../../../src/app/types'
import { getDirectoryUsageSummaryQuery } from '../query'
import { DirectoryOverview } from './landing-view-parts'

type DirectoryOverviewViewProps = {
  composerOverlayHeight: number
  directory: WorkingDirectory
  onOpenChat: (directoryId: string, chatId: string, conversationId: string) => void
}

export function DirectoryOverviewView({
  composerOverlayHeight,
  directory,
  onOpenChat,
}: DirectoryOverviewViewProps) {
  const repository = useSidebarRepositorySnapshot()
  const directoryUsageQuery = useQuery<DirectoryUsageSummary | null>({
    queryKey: desktopQueryKeys.directoryUsageSummary(directory.id),
    queryFn: () => getDirectoryUsageSummaryQuery(directory.id),
    refetchInterval: (query) => (query.state.data?.archivedUsageRefreshing ? 5000 : false),
  })
  const directoryGitQuery = useQuery<DirectoryGitState | null>({
    queryKey: desktopQueryKeys.directoryGitState(directory.id),
    queryFn: () => getSidebarRepositoryStateQuery(directory.id),
    enabled: Boolean(repository.getGitState),
  })

  return (
    <DirectoryOverview
      composerOverlayHeight={composerOverlayHeight}
      directory={directory}
      gitState={
        repository.getGitState
          ? repository.state?.directoryId === directory.id
            ? repository.state
            : directoryGitQuery.data
          : null
      }
      usageLoading={directoryUsageQuery.isLoading}
      usageSummary={directoryUsageQuery.data}
      onOpenChat={onOpenChat}
    />
  )
}
