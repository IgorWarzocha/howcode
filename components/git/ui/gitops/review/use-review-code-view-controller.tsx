import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { type RefObject, useCallback, useMemo } from 'react'
import type { GitOpsAnnotationMetadata } from './pierre-review-adapter'
import { ReviewAnnotationCard, type ReviewAnnotationController } from './review-annotation-card'
import type { ReviewCodeViewController } from './review-code-view'
import type { ReviewTarget } from './review-model'
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
    (annotation: DiffLineAnnotation<GitOpsAnnotationMetadata>) => (
      <ReviewAnnotationCard annotation={annotation} controller={annotationController} />
    ),
    [annotationController],
  )
  const rejectedTargets = useMemo(() => {
    const targets: ReviewTarget[] = []
    for (const comment of comments.items) {
      if (comment.purpose === 'rejection') targets.push(comment.target)
    }
    if (draft.comment?.purpose === 'rejection') targets.push(draft.comment.target)
    return targets
  }, [comments.items, draft.comment])

  return useMemo(
    () => ({
      annotationsByFile,
      rejectedTargets,
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
      rejectedTargets,
      interaction.cancel,
      interaction.select,
      interaction.target,
      renderAnnotation,
    ],
  )
}
