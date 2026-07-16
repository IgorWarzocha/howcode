import { useCallback, useEffect, useEffectEvent, useState } from 'react'

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
  onPreviewEntry: (entryId: string | null) => void
  onRestoreAnchorInThread: (entryId: string) => void
}) {
  const { sessionTreeOpen, leafIdFromList, onPreviewEntry, onRestoreAnchorInThread } = input
  const [anchorEntryId, setAnchorEntryId] = useState<string | null>(null)
  const [previewEntryId, setPreviewEntryId] = useState<string | null>(null)
  const [previousInput, setPreviousInput] = useState({
    sessionTreeOpen,
    leafIdFromList,
  })
  const notifyPreviewEntry = useEffectEvent(onPreviewEntry)

  if (
    previousInput.sessionTreeOpen !== sessionTreeOpen ||
    previousInput.leafIdFromList !== leafIdFromList
  ) {
    const justOpened = sessionTreeOpen && !previousInput.sessionTreeOpen
    setPreviousInput({ sessionTreeOpen, leafIdFromList })
    if (sessionTreeOpen && leafIdFromList) {
      setAnchorEntryId(leafIdFromList)
      if (justOpened) setPreviewEntryId(null)
    } else if (!sessionTreeOpen) {
      setAnchorEntryId(null)
      setPreviewEntryId(null)
    }
  }

  useEffect(() => {
    if (!sessionTreeOpen) notifyPreviewEntry(null)
  }, [sessionTreeOpen])

  const focusEntryId = previewEntryId ?? anchorEntryId

  const focusRow = useCallback(
    (entryId: string) => {
      const nextPreview = browsePreviewEntryIdAfterFocus(anchorEntryId, entryId)
      setPreviewEntryId(nextPreview)
      onPreviewEntry(nextPreview)
      onRestoreAnchorInThread(entryId)
    },
    [anchorEntryId, onPreviewEntry, onRestoreAnchorInThread],
  )

  const clearPreview = useCallback(() => {
    setPreviewEntryId(null)
    onPreviewEntry(null)
  }, [onPreviewEntry])

  const restoreAnchorAndClearPreview = useCallback(() => {
    onPreviewEntry(null)
    if (shouldRestoreAnchorWhenClosingTree(previewEntryId, anchorEntryId) && anchorEntryId) {
      onRestoreAnchorInThread(anchorEntryId)
    }
    setPreviewEntryId(null)
  }, [anchorEntryId, onPreviewEntry, onRestoreAnchorInThread, previewEntryId])

  const finishNavigate = useCallback(
    (entryId: string) => {
      setAnchorEntryId(entryId)
      setPreviewEntryId(null)
      onPreviewEntry(null)
    },
    [onPreviewEntry],
  )

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
