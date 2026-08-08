import type { DiffLineAnnotation } from '@pierre/diffs/react'
import type { ReactNode } from 'react'
import type { ReviewAnnotationMetadata } from './pierre-review-adapter'
import type { ReviewTarget } from './review-model'

export type ReviewCodeViewController = {
  annotationsByFile: Map<string, DiffLineAnnotation<ReviewAnnotationMetadata>[]>
  draftTarget: ReviewTarget | null
  cancelDraft: () => void
  openDraft: (target: ReviewTarget) => void
  renderAnnotation: (annotation: DiffLineAnnotation<ReviewAnnotationMetadata>) => ReactNode
}
