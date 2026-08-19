import { useState } from 'react'
import type { ArchivedThread, ThreadData } from '../desktop/types'

export function useAppShellThreadState() {
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([])
  const [liveThreadData, setLiveThreadData] = useState<ThreadData | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [historyCompactions, setHistoryCompactions] = useState(0)
  const [queryDeferred, setQueryDeferred] = useState(false)

  return {
    archivedThreads,
    historyCompactions,
    liveThreadData,
    queryDeferred,
    refreshKey,
    setArchivedThreads,
    setHistoryCompactions,
    setLiveThreadData,
    setQueryDeferred,
    setRefreshKey,
  }
}
