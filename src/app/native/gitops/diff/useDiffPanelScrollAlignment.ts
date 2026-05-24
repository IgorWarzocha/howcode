import type { CodeViewHandle, FileDiffMetadata } from '@pierre/diffs/react'
import { useEffect } from 'react'
import type { DiffCommentMetadata } from './diff-panel-content.helpers'
import { alignElementInScrollViewport, buildFileDiffRenderKey } from './diff-panel-content.helpers'
import type { SavedDiffComment } from './diffCommentStore'

function getDatasetValue(element: HTMLElement, key: string) {
  return element.dataset[key]
}

export function useDiffPanelScrollAlignment({
  collapsedFiles,
  draftCardRef,
  draftTarget,
  codeViewRef,
  renderableFiles,
  savedComments,
  scrollContainerRef,
  selectedCommentId,
  selectedCommentJumpKey,
  selectedFilePath,
  setCollapsedFiles,
}: {
  collapsedFiles: Record<string, boolean>
  draftCardRef: React.RefObject<HTMLDivElement | null>
  draftTarget: {
    fileKey: string
    filePath: string
    side: 'deletions' | 'additions'
    lineNumber: number
    endSide?: 'deletions' | 'additions' | undefined
    endLineNumber?: number | undefined
  } | null
  codeViewRef: React.RefObject<CodeViewHandle<DiffCommentMetadata> | null>
  renderableFiles: FileDiffMetadata[]
  savedComments: SavedDiffComment[]
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  selectedCommentId: string | null
  selectedCommentJumpKey: number
  selectedFilePath: string | null
  setCollapsedFiles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}) {
  useEffect(() => {
    if (!draftTarget) {
      return
    }

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const draftCard = draftCardRef.current
      if (!draftCard) {
        return
      }

      alignElementInScrollViewport({
        scrollContainer,
        targetElement: draftCard,
        mode: 'draft-fit',
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [draftCardRef, draftTarget, scrollContainerRef])

  useEffect(() => {
    if (!selectedCommentId || selectedCommentJumpKey < 0) {
      return
    }

    const scrollContainer = scrollContainerRef.current
    const selectedComment = savedComments.find((comment) => comment.id === selectedCommentId)
    if (!(scrollContainer && selectedComment)) {
      return
    }

    if (collapsedFiles[selectedComment.fileKey] === true) {
      setCollapsedFiles((current) => ({
        ...current,
        [selectedComment.fileKey]: false,
      }))
      return
    }

    const selectedFileIndex = renderableFiles.findIndex(
      (fileDiff) => buildFileDiffRenderKey(fileDiff) === selectedComment.fileKey,
    )
    if (selectedFileIndex >= 0) {
      codeViewRef.current?.scrollTo({
        type: 'item',
        id: selectedComment.fileKey,
        align: 'center',
        behavior: 'instant',
      })
    }

    let cancelled = false
    let attempts = 0
    let frame = 0

    const alignSelectedComment = () => {
      if (cancelled) {
        return
      }

      const commentElement = Array.from(
        scrollContainer.querySelectorAll<HTMLElement>('[data-saved-diff-comment-id]'),
      ).find((element) => getDatasetValue(element, 'savedDiffCommentId') === selectedCommentId)

      if (commentElement) {
        alignElementInScrollViewport({
          scrollContainer,
          targetElement: commentElement,
          mode: 'center',
        })
        return
      }

      if (attempts >= 6) {
        const fileElement = Array.from(
          scrollContainer.querySelectorAll<HTMLElement>('[data-diff-file-path]'),
        ).find((element) => getDatasetValue(element, 'diffFilePath') === selectedFilePath)

        if (fileElement) {
          alignElementInScrollViewport({
            scrollContainer,
            targetElement: fileElement,
            mode: 'center',
          })
        }
        return
      }

      attempts += 1
      frame = window.requestAnimationFrame(alignSelectedComment)
    }

    frame = window.requestAnimationFrame(alignSelectedComment)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [
    collapsedFiles,
    codeViewRef,
    renderableFiles,
    savedComments,
    scrollContainerRef,
    selectedCommentId,
    selectedCommentJumpKey,
    selectedFilePath,
    setCollapsedFiles,
  ])
}
