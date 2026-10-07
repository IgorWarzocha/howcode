import type { DiffLineAnnotation } from '@pierre/diffs/react'
import type { ReactNode } from 'react'
import type { GitOpsAnnotationMetadata } from './pierre-review-adapter'
import type { LineRangeReviewTarget, ReviewPurpose, ReviewTarget } from './review-model'

export type ReviewCodeViewController = {
  annotationsByFile: Map<string, DiffLineAnnotation<GitOpsAnnotationMetadata>[]>
  rejectedTargets: readonly ReviewTarget[]
  interaction: {
    cancel: () => void
    select: (target: LineRangeReviewTarget | null) => void
    startDraft: (target: ReviewTarget, purpose?: ReviewPurpose) => void
    target: ReviewTarget | null
  }
  renderAnnotation: (annotation: DiffLineAnnotation<GitOpsAnnotationMetadata>) => ReactNode
}
