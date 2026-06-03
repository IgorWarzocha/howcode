import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ThreadData } from '../desktop/types'
import { desktopQueryKeys, getThreadPreviewAtEntryQuery } from '../query/desktop-query'
import {
  howcodeSessionTreePreviewEvent,
  type SessionTreePreviewDetail,
} from '../thread/session-tree-preview'

export function useSessionTreePreviewThread(
  selectedSessionPath: string | null,
  historyCompactions = 0,
) {
  const [preview, setPreview] = useState<SessionTreePreviewDetail | null>(null)
  const persistedPath = getPersistedSessionPath(selectedSessionPath)

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<SessionTreePreviewDetail>).detail
      if (!detail?.sessionPath?.trim()) return
      const normalizedPath = persistedPath
      if (!normalizedPath || detail.sessionPath.trim() !== normalizedPath) {
        setPreview(null)
        return
      }
      if (!detail.previewEntryId?.trim()) {
        setPreview(null)
        return
      }
      setPreview({
        sessionPath: detail.sessionPath.trim(),
        previewEntryId: detail.previewEntryId.trim(),
      })
    }

    window.addEventListener(howcodeSessionTreePreviewEvent, handlePreview)
    return () => window.removeEventListener(howcodeSessionTreePreviewEvent, handlePreview)
  }, [persistedPath])

  const previewQuery = useQuery<ThreadData | null>({
    queryKey: preview?.previewEntryId
      ? desktopQueryKeys.threadPreviewAtEntry(
          persistedPath ?? '',
          preview.previewEntryId,
          historyCompactions,
        )
      : ['desktop', 'threadPreview', null],
    queryFn: () =>
      persistedPath && preview?.previewEntryId
        ? getThreadPreviewAtEntryQuery(persistedPath, preview.previewEntryId, historyCompactions)
        : Promise.resolve(null),
    enabled: Boolean(persistedPath && preview?.previewEntryId),
    staleTime: 30_000,
  })

  return {
    previewEntryId: preview?.previewEntryId ?? null,
    previewThreadData: previewQuery.data ?? null,
    previewThreadLoading: previewQuery.isLoading || previewQuery.isFetching,
  }
}
