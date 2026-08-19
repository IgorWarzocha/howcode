import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import type { ThreadCustomMessageRecord, ThreadData } from '../desktop/types'
import { useDesktopThreadQuery } from '../hooks/useDesktopThread'
import { useSessionTreePreviewThread } from '../hooks/useSessionTreePreviewThread'
import { mergePreviewThreadWithLive } from '../thread/session-tree-preview'

function mergeCustomMessages(
  liveMessages: ThreadCustomMessageRecord[] | undefined,
  snapshotMessages: ThreadCustomMessageRecord[] | undefined,
) {
  if ((snapshotMessages?.length ?? 0) === 0) return liveMessages
  if ((liveMessages?.length ?? 0) === 0) return snapshotMessages
  if (!(liveMessages && snapshotMessages)) return liveMessages ?? snapshotMessages
  const byId = new Map(liveMessages.map((message) => [message.id, message]))
  for (const message of snapshotMessages) byId.set(message.id, message)
  return [...byId.values()]
}

function mergeThreadHistorySideChannels(liveThread: ThreadData, snapshotThread: ThreadData | null) {
  if (!snapshotThread || liveThread.sessionPath !== snapshotThread.sessionPath) return liveThread
  const customMessages = mergeCustomMessages(
    liveThread.customMessages,
    snapshotThread.customMessages,
  )
  return customMessages === liveThread.customMessages
    ? liveThread
    : { ...liveThread, customMessages }
}

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
  const sessionTreePreview = useSessionTreePreviewThread(
    input.selectedSessionPath,
    input.threadHistoryCompactions,
  )
  const selectedPersistedSessionPath = getPersistedSessionPath(input.selectedSessionPath)
  const threadDataMatchesSelection = threadData?.sessionPath === selectedPersistedSessionPath
  const liveDataMatchesSelection =
    input.liveThreadData?.sessionPath === selectedPersistedSessionPath
  const activeThreadLoading = Boolean(
    selectedPersistedSessionPath &&
      (threadQuery.isLoading ||
        threadQuery.isFetching ||
        (sessionTreePreview.previewEntryId && sessionTreePreview.previewThreadLoading)) &&
      !(liveDataMatchesSelection || threadDataMatchesSelection),
  )

  const baseEffectiveThreadData =
    input.threadHistoryCompactions === 0 &&
    input.liveThreadData?.sessionPath === input.selectedSessionPath
      ? mergeThreadHistorySideChannels(
          input.liveThreadData,
          threadDataMatchesSelection ? threadData : null,
        )
      : threadDataMatchesSelection
        ? threadData
        : null

  const effectiveThreadData =
    sessionTreePreview.previewThreadData && sessionTreePreview.previewEntryId
      ? mergePreviewThreadWithLive(sessionTreePreview.previewThreadData, baseEffectiveThreadData)
      : baseEffectiveThreadData

  return { activeThreadLoading, effectiveThreadData }
}
