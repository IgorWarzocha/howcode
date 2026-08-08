import type { SelectedLineRange } from '@pierre/diffs'
import type { DiffLineAnnotation } from '@pierre/diffs/react'
import {
  createLineRangeTarget,
  type DiffSide,
  type LineRangeReviewTarget,
  type ReviewTarget,
} from './review-model'

export type ReviewAnnotation =
  | { id: string; body: string; kind: 'comment'; target: ReviewTarget }
  | { id: string; kind: 'draft'; target: ReviewTarget }
  | { id: string; kind: 'selection-action'; target: ReviewTarget }

// Pierre's annotation metadata conditional distributes over unions, so keep the
// discriminant nested and expose one stable metadata shape to CodeView.
export type GitOpsAnnotationMetadata = {
  gitOps:
    | { kind: 'review'; review: ReviewAnnotation }
    | { kind: 'change-action'; fileKey: string; hunkIndex: number }
}

export function getReviewAnnotation(annotation: DiffLineAnnotation<GitOpsAnnotationMetadata>) {
  const value = annotation.metadata.gitOps
  return value.kind === 'review' ? value.review : null
}

function isDiffSide(side: SelectedLineRange['side']): side is DiffSide {
  return side === 'deletions' || side === 'additions'
}

export function reviewTargetFromPierreSelection({
  fileKey,
  filePath,
  range,
}: {
  fileKey: string
  filePath: string
  range: SelectedLineRange
}): LineRangeReviewTarget | null {
  if (!isDiffSide(range.side)) return null
  return createLineRangeTarget({
    fileKey,
    filePath,
    side: range.side,
    lineNumber: range.start,
    endSide: isDiffSide(range.endSide) ? range.endSide : range.side,
    endLineNumber: range.end,
  })
}

export function reviewTargetToPierreSelection(target: ReviewTarget): SelectedLineRange | null {
  if (target.kind === 'file') return null
  return {
    start: target.start.lineNumber,
    end: target.end.lineNumber,
    side: target.start.side,
    endSide: target.end.side,
  }
}

export function reviewTargetToPierreAnnotation(
  review: ReviewAnnotation,
): DiffLineAnnotation<GitOpsAnnotationMetadata> {
  const { target } = review
  const metadata = { gitOps: { kind: 'review' as const, review } }
  if (target.kind === 'file') {
    return { side: 'additions', lineNumber: 0, metadata }
  }

  return {
    side: target.start.side,
    lineNumber: target.start.lineNumber,
    metadata,
  }
}

export function reanchorReviewTargetFromPierreAnnotation(
  annotation: DiffLineAnnotation<GitOpsAnnotationMetadata>,
) {
  const review = getReviewAnnotation(annotation)
  if (!review) return null
  const { target } = review
  if (target.kind === 'file' || !isDiffSide(annotation.side) || annotation.lineNumber <= 0) {
    return target
  }

  const lineDelta = annotation.lineNumber - target.start.lineNumber
  return createLineRangeTarget({
    fileKey: target.fileKey,
    filePath: target.filePath,
    side: annotation.side,
    lineNumber: annotation.lineNumber,
    endSide: target.end.side === target.start.side ? annotation.side : target.end.side,
    endLineNumber:
      target.end.side === target.start.side
        ? Math.max(1, target.end.lineNumber + lineDelta)
        : target.end.lineNumber,
  })
}
