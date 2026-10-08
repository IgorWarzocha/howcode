import { getDirectoryGitStateQuery } from '@howcode/git-integration/client'
import { useQuery } from '@tanstack/react-query'
import type {
  DesktopActionInvoker,
  DirectoryGitState,
  DirectoryUsageSummary,
} from '../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'
import type { WorkingDirectory } from '../../../../src/app/types'
import { getDirectoryUsageSummaryQuery } from '../query'
import { DirectoryOverview } from './landing-view-parts'

type DirectoryOverviewViewProps = {
  composerOverlayHeight: number
  directory: WorkingDirectory
  onOpenChat: (directoryId: string, chatId: string, conversationId: string) => void
  onAction: DesktopActionInvoker
}

export function DirectoryOverviewView({
  composerOverlayHeight,
  directory,
  onOpenChat,
  onAction,
}: DirectoryOverviewViewProps) {
  const directoryUsageQuery = useQuery<DirectoryUsageSummary | null>({
    queryKey: desktopQueryKeys.directoryUsageSummary(directory.id),
    queryFn: () => getDirectoryUsageSummaryQuery(directory.id),
    refetchInterval: (query) => (query.state.data?.archivedUsageRefreshing ? 5000 : false),
  })
  const directoryGitQuery = useQuery<DirectoryGitState | null>({
    queryKey: desktopQueryKeys.directoryGitState(directory.id),
    queryFn: () => getDirectoryGitStateQuery(directory.id),
  })

  return (
    <DirectoryOverview
      composerOverlayHeight={composerOverlayHeight}
      directory={directory}
      gitState={directoryGitQuery.data}
      usageLoading={directoryUsageQuery.isLoading}
      usageSummary={directoryUsageQuery.data}
      onOpenChat={onOpenChat}
      onAction={onAction}
    />
  )
}
