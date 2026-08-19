import {
  type DiffLineAnnotation,
  diffAcceptRejectHunk,
  type FileDiffMetadata,
  type Hunk,
} from '@pierre/diffs'
import type { GitOpsAnnotationMetadata } from './pierre-review-adapter'
import { createLineRangeTarget } from './review-model'

export type ChangeReviewTarget = { fileKey: string; hunkIndex: number }

function getChangeLineSpan(hunk: Hunk) {
  let additionLine = hunk.additionStart
  let deletionLine = hunk.deletionStart
  let firstAddition: number | null = null
  let firstDeletion: number | null = null
  let lastAddition: number | null = null
  let lastDeletion: number | null = null

  for (const content of hunk.hunkContent) {
    if (content.type === 'context') {
      additionLine += content.lines
      deletionLine += content.lines
      continue
    }

    if (content.additions > 0) {
      firstAddition ??= additionLine
      lastAddition = additionLine + content.additions - 1
    }
    if (content.deletions > 0) {
      firstDeletion ??= deletionLine
      lastDeletion = deletionLine + content.deletions - 1
    }
    additionLine += content.additions
    deletionLine += content.deletions
  }

  if (firstAddition !== null && lastAddition !== null) {
    return { side: 'additions' as const, start: firstAddition, end: lastAddition }
  }
  if (firstDeletion !== null && lastDeletion !== null) {
    return { side: 'deletions' as const, start: firstDeletion, end: lastDeletion }
  }
  return null
}

export function buildChangeReviewAnnotations(
  fileKey: string,
  fileDiff: FileDiffMetadata,
): DiffLineAnnotation<GitOpsAnnotationMetadata>[] {
  const annotations: DiffLineAnnotation<GitOpsAnnotationMetadata>[] = []
  for (const [hunkIndex, hunk] of fileDiff.hunks.entries()) {
    const span = getChangeLineSpan(hunk)
    if (!span) continue
    annotations.push({
      side: span.side,
      lineNumber: span.end,
      metadata: { gitOps: { kind: 'change-action', fileKey, hunkIndex } },
    })
  }
  return annotations
}

export function getChangeRejectionTarget({
  fileDiff,
  fileKey,
  filePath,
  hunkIndex,
}: {
  fileDiff: FileDiffMetadata
  fileKey: string
  filePath: string
  hunkIndex: number
}) {
  const hunk = fileDiff.hunks[hunkIndex]
  const span = hunk ? getChangeLineSpan(hunk) : null
  return span
    ? createLineRangeTarget({
        fileKey,
        filePath,
        side: span.side,
        lineNumber: span.start,
        endLineNumber: span.end,
      })
    : null
}

export function keepReviewedChange(fileDiff: FileDiffMetadata, hunkIndex: number) {
  return diffAcceptRejectHunk(fileDiff, hunkIndex, 'accept')
}
