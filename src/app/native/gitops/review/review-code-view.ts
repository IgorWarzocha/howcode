import type { DiffLineAnnotation } from '@pierre/diffs/react'
import type { ReactNode } from 'react'
import type { ReviewAnnotationMetadata } from './pierre-review-adapter'
import type { LineRangeReviewTarget, ReviewTarget } from './review-model'

export type ReviewCodeViewController = {
  annotationsByFile: Map<string, DiffLineAnnotation<ReviewAnnotationMetadata>[]>
  interaction: {
    cancel: () => void
    select: (target: LineRangeReviewTarget | null) => void
    startDraft: (target: ReviewTarget) => void
    target: ReviewTarget | null
  }
  renderAnnotation: (annotation: DiffLineAnnotation<ReviewAnnotationMetadata>) => ReactNode
}
