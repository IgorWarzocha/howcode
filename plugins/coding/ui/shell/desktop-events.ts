import type { DesktopThreadEndContribution } from '@howcode/app-shell'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import type { ProjectGitState } from '../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'
import type { View } from '../../../../src/app/types'
import { notifyProjectDiffInvalidated } from '../hooks/project-diff-invalidation'

type QueryClientLike = {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown
}

export function invalidateProjectWorktreeQueries({
  activeView,
  projectId,
  queryClient,
}: {
  activeView: View
  projectId: string
  queryClient: QueryClientLike
}) {
  if (activeView === 'gitops') notifyProjectDiffInvalidated(projectId)
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffStatsPrefix(projectId),
  })
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectDiffImagePreviewPrefix(projectId),
  })
  void queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.projectCommitsPrefix(projectId),
  })
}

export function useCodingDesktopEventContribution({
  enabled,
  composerProjectId,
  loadProjectThreads,
  loadProjectGitState,
  setProjectGitState,
  queryClient,
}: {
  enabled: boolean
  composerProjectId: string
  loadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  queryClient: QueryClientLike
}): DesktopThreadEndContribution {
  return useMemo(
    () => ({
      refreshThreadList(event, activeView) {
        if (!enabled) return
        if (event.isChat === true) {
          if (activeView === 'chat') void loadProjectThreads(event.projectId, { chat: true })
        } else if (activeView !== 'chat') {
          void loadProjectThreads(event.projectId)
        }
      },
      refreshProjectState(event, activeView) {
        // Cache invalidation also ran with coding disabled before this policy moved here.
        invalidateProjectWorktreeQueries({ activeView, projectId: event.projectId, queryClient })
        void queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.projectUsageSummary(event.projectId),
        })
        if (enabled && event.projectId === composerProjectId) {
          void loadProjectGitState(event.projectId).then(setProjectGitState)
        }
      },
    }),
    [
      enabled,
      composerProjectId,
      loadProjectThreads,
      loadProjectGitState,
      setProjectGitState,
      queryClient,
    ],
  )
}
