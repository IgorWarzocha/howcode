import { useCallback, useEffect, useRef, useState } from 'react'

export function browsePreviewEntryIdAfterFocus(
  anchorEntryId: string | null,
  entryId: string,
): string | null {
  if (!anchorEntryId) return entryId
  if (entryId === anchorEntryId) return null
  return entryId
}

export function shouldRestoreAnchorWhenClosingTree(
  previewEntryId: string | null,
  anchorEntryId: string | null,
) {
  return Boolean(previewEntryId && anchorEntryId)
}

export type ComposerSessionTreeBrowseState = {
  anchorEntryId: string | null
  previewEntryId: string | null
  /** Row highlight while the panel is open (preview or anchor). */
  focusEntryId: string | null
}

export function useComposerSessionTreeBrowse(input: {
  sessionTreeOpen: boolean
  leafIdFromList: string | null
  onRestoreAnchorInThread: (entryId: string) => void
}) {
  const { sessionTreeOpen, leafIdFromList, onRestoreAnchorInThread } = input
  const [anchorEntryId, setAnchorEntryId] = useState<string | null>(null)
  const [previewEntryId, setPreviewEntryId] = useState<string | null>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    const justOpened = sessionTreeOpen && !wasOpenRef.current
    const justClosed = !sessionTreeOpen && wasOpenRef.current
    wasOpenRef.current = sessionTreeOpen

    if (justOpened && leafIdFromList) {
      setAnchorEntryId(leafIdFromList)
      setPreviewEntryId(null)
      return
    }

    if (justClosed) {
      setAnchorEntryId(null)
      setPreviewEntryId(null)
    }
  }, [leafIdFromList, sessionTreeOpen])

  useEffect(() => {
    if (!(sessionTreeOpen && leafIdFromList)) return
    setAnchorEntryId(leafIdFromList)
  }, [leafIdFromList, sessionTreeOpen])

  const focusEntryId = previewEntryId ?? anchorEntryId

  const focusRow = useCallback(
    (entryId: string) => {
      setPreviewEntryId(browsePreviewEntryIdAfterFocus(anchorEntryId, entryId))
      onRestoreAnchorInThread(entryId)
    },
    [anchorEntryId, onRestoreAnchorInThread],
  )

  const clearPreview = useCallback(() => {
    setPreviewEntryId(null)
  }, [])

  const restoreAnchorAndClearPreview = useCallback(() => {
    if (shouldRestoreAnchorWhenClosingTree(previewEntryId, anchorEntryId) && anchorEntryId) {
      onRestoreAnchorInThread(anchorEntryId)
    }
    setPreviewEntryId(null)
  }, [anchorEntryId, onRestoreAnchorInThread, previewEntryId])

  const finishNavigate = useCallback((entryId: string) => {
    setAnchorEntryId(entryId)
    setPreviewEntryId(null)
  }, [])

  return {
    anchorEntryId,
    previewEntryId,
    focusEntryId,
    focusRow,
    clearPreview,
    restoreAnchorAndClearPreview,
    finishNavigate,
  }
}
