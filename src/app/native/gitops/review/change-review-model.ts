import {
  type DiffLineAnnotation,
  diffAcceptRejectHunk,
  type FileDiffMetadata,
  type Hunk,
} from '@pierre/diffs'
import type { GitOpsAnnotationMetadata } from './pierre-review-adapter'

export type ChangeReviewDecision = 'undo' | 'keep'
export type ChangeReviewTarget = { fileKey: string; hunkIndex: number }

function getChangeAnchor(hunk: Hunk) {
  let additionLine = hunk.additionStart
  let deletionLine = hunk.deletionStart
  let lastAddition: number | null = null
  let lastDeletion: number | null = null

  for (const content of hunk.hunkContent) {
    if (content.type === 'context') {
      additionLine += content.lines
      deletionLine += content.lines
      continue
    }

    if (content.additions > 0) lastAddition = additionLine + content.additions - 1
    if (content.deletions > 0) lastDeletion = deletionLine + content.deletions - 1
    additionLine += content.additions
    deletionLine += content.deletions
  }

  if (lastAddition !== null) return { side: 'additions' as const, lineNumber: lastAddition }
  if (lastDeletion !== null) return { side: 'deletions' as const, lineNumber: lastDeletion }
  return null
}

export function buildChangeReviewAnnotations(
  fileKey: string,
  fileDiff: FileDiffMetadata,
): DiffLineAnnotation<GitOpsAnnotationMetadata>[] {
  const annotations: DiffLineAnnotation<GitOpsAnnotationMetadata>[] = []
  for (const [hunkIndex, hunk] of fileDiff.hunks.entries()) {
    const anchor = getChangeAnchor(hunk)
    if (!anchor) continue
    annotations.push({
      ...anchor,
      metadata: { gitOps: { kind: 'change-action', fileKey, hunkIndex } },
    })
  }
  return annotations
}

export function resolveReviewedChange(
  fileDiff: FileDiffMetadata,
  hunkIndex: number,
  decision: ChangeReviewDecision,
) {
  return diffAcceptRejectHunk(fileDiff, hunkIndex, decision === 'keep' ? 'accept' : 'reject')
}
