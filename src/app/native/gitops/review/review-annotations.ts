import type { DiffLineAnnotation } from '@pierre/diffs/react'
import {
  type GitOpsAnnotationMetadata,
  type ReviewAnnotation,
  reviewTargetToPierreAnnotation,
} from './pierre-review-adapter'
import type { ReviewInteraction } from './review-interaction'
import { getReviewTargetKey, type SavedReviewComment } from './review-model'

function addAnnotation(
  annotationsByFile: Map<string, DiffLineAnnotation<GitOpsAnnotationMetadata>[]>,
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
  const annotationsByFile = new Map<string, DiffLineAnnotation<GitOpsAnnotationMetadata>[]>()

  for (const comment of comments) {
    addAnnotation(annotationsByFile, {
      id: comment.id,
      body: comment.body,
      kind: 'comment',
      purpose: comment.purpose,
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
      purpose: interaction.draft.purpose,
      target: interaction.draft.target,
    })
  }

  return annotationsByFile
}
