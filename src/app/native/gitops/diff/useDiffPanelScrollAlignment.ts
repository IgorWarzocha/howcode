import type { CodeViewHandle, FileDiffMetadata } from '@pierre/diffs/react'
import { useEffect } from 'react'
import {
  type GitOpsAnnotationMetadata,
  reviewTargetToPierreSelection,
} from '../review/pierre-review-adapter'
import type { ReviewTarget, SavedReviewComment } from '../review/review-model'
import { alignElementInScrollViewport, buildFileDiffRenderKey } from './diff-panel-content.helpers'

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
  draftTarget: ReviewTarget | null
  codeViewRef: React.RefObject<CodeViewHandle<GitOpsAnnotationMetadata> | null>
  renderableFiles: FileDiffMetadata[]
  savedComments: SavedReviewComment[]
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

    if (collapsedFiles[selectedComment.target.fileKey] === true) {
      setCollapsedFiles((current) => ({
        ...current,
        [selectedComment.target.fileKey]: false,
      }))
      return
    }

    const selectedFileExists = renderableFiles.some(
      (fileDiff) => buildFileDiffRenderKey(fileDiff) === selectedComment.target.fileKey,
    )
    if (selectedFileExists) {
      const range = reviewTargetToPierreSelection(selectedComment.target)
      codeViewRef.current?.scrollTo(
        range
          ? {
              type: 'range',
              id: selectedComment.target.fileKey,
              range,
              align: 'center',
              behavior: 'instant',
            }
          : {
              type: 'item',
              id: selectedComment.target.fileKey,
              align: 'center',
              behavior: 'instant',
            },
      )
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
