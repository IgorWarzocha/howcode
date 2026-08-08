import type { DiffLineAnnotation } from '@pierre/diffs/react'
import {
  type ReviewAnnotation,
  type ReviewAnnotationMetadata,
  reviewTargetToPierreAnnotation,
} from './pierre-review-adapter'
import type { ReviewInteraction } from './review-interaction'
import { getReviewTargetKey, type SavedReviewComment } from './review-model'

function addAnnotation(
  annotationsByFile: Map<string, DiffLineAnnotation<ReviewAnnotationMetadata>[]>,
  annotation: ReviewAnnotation,
) {
  const entries = annotationsByFile.get(annotation.target.fileKey) ?? []
  entries.push(reviewTargetToPierreAnnotation(annotation))
  annotationsByFile.set(annotation.target.fileKey, entries)
}

export function buildReviewAnnotations({
  comments,
  interaction,
}: {
  comments: readonly SavedReviewComment[]
  interaction: ReviewInteraction
}) {
  const annotationsByFile = new Map<string, DiffLineAnnotation<ReviewAnnotationMetadata>[]>()

  for (const comment of comments) {
    addAnnotation(annotationsByFile, {
      id: comment.id,
      body: comment.body,
      kind: 'comment',
      target: comment.target,
    })
  }

  if (interaction.kind === 'selection') {
    addAnnotation(annotationsByFile, {
      id: `selection:${getReviewTargetKey(interaction.target)}`,
      kind: 'selection-action',
      target: interaction.target,
    })
  }

  if (interaction.kind === 'draft') {
    addAnnotation(annotationsByFile, {
      id: `draft:${getReviewTargetKey(interaction.draft.target)}`,
      kind: 'draft',
      target: interaction.draft.target,
    })
  }

  return annotationsByFile
}
