import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { type RefObject, useCallback, useMemo } from 'react'
import type { ReviewAnnotationMetadata } from './pierre-review-adapter'
import { ReviewAnnotationCard, type ReviewAnnotationController } from './review-annotation-card'
import type { ReviewCodeViewController } from './review-code-view'
import type { useDiffReviewState } from './use-diff-review-state'

type DiffReviewState = ReturnType<typeof useDiffReviewState>

export function useReviewCodeViewController({
  draftCardRef,
  review,
}: {
  draftCardRef: RefObject<HTMLDivElement | null>
  review: DiffReviewState
}): ReviewCodeViewController {
  const { annotationsByFile, comments, draft, interaction } = review
  const annotationController = useMemo<ReviewAnnotationController>(
    () => ({
      comments: { remove: comments.remove },
      draft: {
        cancel: interaction.cancel,
        cardRef: draftCardRef,
        comment: draft.comment,
        persist: draft.persist,
        setBody: draft.setBody,
      },
      selection: {
        addComment: draft.open,
        cancel: interaction.cancel,
      },
    }),
    [
      comments.remove,
      draft.comment,
      draft.open,
      draft.persist,
      draft.setBody,
      draftCardRef,
      interaction.cancel,
    ],
  )

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<ReviewAnnotationMetadata>) => (
      <ReviewAnnotationCard annotation={annotation} controller={annotationController} />
    ),
    [annotationController],
  )

  return useMemo(
    () => ({
      annotationsByFile,
      interaction: {
        cancel: interaction.cancel,
        select: interaction.select,
        startDraft: draft.open,
        target: interaction.target,
      },
      renderAnnotation,
    }),
    [
      annotationsByFile,
      draft.open,
      interaction.cancel,
      interaction.select,
      interaction.target,
      renderAnnotation,
    ],
  )
}
