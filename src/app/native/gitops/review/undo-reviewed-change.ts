import type { FileDiffMetadata } from '@pierre/diffs'
import type { ProjectFileWriteResult } from '../../../desktop/types'
import type { DiffFileContentController } from '../diff/use-diff-file-content'
import type { GitOpsFileActions } from '../edit/gitops-file-actions'
import { resolveReviewedChange } from './change-review-model'

export type UndoReviewedChangeResult =
  | { kind: 'undone'; fileDiff: FileDiffMetadata }
  | { kind: 'failed'; message: string }

export function canUndoReviewedChange(fileDiff: FileDiffMetadata) {
  return fileDiff.type !== 'new' && fileDiff.type !== 'deleted'
}

function describeUndoFailure(result: Exclude<ProjectFileWriteResult, { kind: 'written' }>) {
  if (result.kind === 'conflict') {
    return `Could not undo ${result.path} because it changed outside Howcode.`
  }
  return `Could not undo ${result.issue.path}.`
}

export async function undoReviewedChange({
  fileActions,
  fileContent,
  fileDiff,
  hunkIndex,
  projectId,
}: {
  fileActions: GitOpsFileActions
  fileContent: DiffFileContentController
  fileDiff: FileDiffMetadata
  hunkIndex: number
  projectId: string
}): Promise<UndoReviewedChangeResult> {
  if (!canUndoReviewedChange(fileDiff)) {
    return { kind: 'failed', message: 'This file change cannot be undone safely.' }
  }

  const prepared = await fileContent.prepareWrite(fileDiff)
  const resolved = resolveReviewedChange(fileDiff, hunkIndex, 'undo')
  const result = await fileActions.write({
    projectId,
    path: prepared.path,
    contents: resolved.additionLines.join(''),
    expectedRevision: prepared.revision,
  })
  return result.kind === 'written'
    ? { kind: 'undone', fileDiff: resolved }
    : { kind: 'failed', message: describeUndoFailure(result) }
}
