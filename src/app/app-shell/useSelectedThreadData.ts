import { getPersistedSessionPath } from '../../../shared/session-paths'
import type { ThreadData } from '../desktop/types'
import { useDesktopThreadQuery } from '../hooks/useDesktopThread'

export function useSelectedThreadData(input: {
  liveThreadData: ThreadData | null
  selectedSessionPath: string | null
  threadHistoryCompactions: number
  threadQueryDeferred: boolean
  threadRefreshKey: number
}) {
  const threadQuery = useDesktopThreadQuery(
    input.selectedSessionPath,
    input.threadRefreshKey,
    input.threadHistoryCompactions,
    { enabled: !input.threadQueryDeferred },
  )
  const threadData = threadQuery.data ?? null
  const selectedPersistedSessionPath = getPersistedSessionPath(input.selectedSessionPath)
  const threadDataMatchesSelection = threadData?.sessionPath === selectedPersistedSessionPath
  const liveDataMatchesSelection =
    input.liveThreadData?.sessionPath === selectedPersistedSessionPath
  const activeThreadLoading = Boolean(
    selectedPersistedSessionPath &&
      (threadQuery.isLoading || threadQuery.isFetching) &&
      !(liveDataMatchesSelection || threadDataMatchesSelection),
  )
  const effectiveThreadData =
    input.threadHistoryCompactions === 0 &&
    input.liveThreadData?.sessionPath === input.selectedSessionPath
      ? input.liveThreadData
      : threadDataMatchesSelection
        ? threadData
        : null

  return { activeThreadLoading, effectiveThreadData }
}
