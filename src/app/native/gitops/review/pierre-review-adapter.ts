import type { SelectedLineRange } from '@pierre/diffs'
import type { DiffLineAnnotation } from '@pierre/diffs/react'
import {
  createLineRangeTarget,
  type DiffSide,
  type LineRangeReviewTarget,
  type ReviewTarget,
} from './review-model'

export type ReviewAnnotationMetadata = {
  id: string
  body: string
  kind: 'comment' | 'draft'
  target: ReviewTarget
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

export function reviewTargetToPierreAnnotation({
  body,
  id,
  kind,
  target,
}: ReviewAnnotationMetadata): DiffLineAnnotation<ReviewAnnotationMetadata> {
  if (target.kind === 'file') {
    return { side: 'additions', lineNumber: 0, metadata: { id, body, kind, target } }
  }

  return {
    side: target.start.side,
    lineNumber: target.start.lineNumber,
    metadata: { id, body, kind, target },
  }
}
