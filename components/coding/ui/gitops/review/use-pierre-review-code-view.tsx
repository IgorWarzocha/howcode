import type { CodeViewItem, CodeViewLineSelection, SelectedLineRange } from '@pierre/diffs'
import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { useCallback, useMemo } from 'react'
import { ChangeReviewAction } from './change-review-action'
import { type ChangeReviewTarget, getChangeRejectionTarget } from './change-review-model'
import {
  type GitOpsAnnotationMetadata,
  reviewTargetFromPierreSelection,
  reviewTargetToPierreSelection,
} from './pierre-review-adapter'
import type { ReviewCodeViewController } from './review-code-view'
import { isSameReviewTarget } from './review-model'
import type { DiffChangeReviewController } from './use-diff-change-review'

export type ReviewFileIdentity = { fileKey: string; filePath: string }
type ReviewContextExpansionController = {
  expand: (target: ChangeReviewTarget) => void
  expandedFileKeys: ReadonlySet<string>
}

export function usePierreReviewCodeView({
  changeReview,
  contextExpansion,
  fileIdentityByKey,
  review,
}: {
  changeReview: DiffChangeReviewController
  contextExpansion: ReviewContextExpansionController
  fileIdentityByKey: ReadonlyMap<string, ReviewFileIdentity>
  review: ReviewCodeViewController
}) {
  const { cancel, select, startDraft, target: interactionTarget } = review.interaction
  const selectedLines = useMemo(() => {
    if (!interactionTarget) return null
    const range = reviewTargetToPierreSelection(interactionTarget)
    return range ? { id: interactionTarget.fileKey, range } : null
  }, [interactionTarget])

  const onSelectedLinesChange = useCallback(
    (selection: CodeViewLineSelection | null) => {
      if (!selection) {
        cancel()
        return
      }
      const identity = fileIdentityByKey.get(selection.id)
      if (!identity) return
      const target = reviewTargetFromPierreSelection({ ...identity, range: selection.range })
      if (target) select(target)
    },
    [cancel, fileIdentityByKey, select],
  )

  const renderAnnotation = useCallback(
    (
      annotation: DiffLineAnnotation<GitOpsAnnotationMetadata>,
      item: CodeViewItem<GitOpsAnnotationMetadata>,
    ) => {
      const metadata = annotation.metadata.gitOps
      if (metadata.kind === 'change-action') {
        if (item.type !== 'diff') return null
        const target = { fileKey: metadata.fileKey, hunkIndex: metadata.hunkIndex }
        const identity = fileIdentityByKey.get(item.id)
        if (!identity) return null
        const rejectionTarget = getChangeRejectionTarget({
          fileDiff: item.fileDiff,
          ...identity,
          hunkIndex: target.hunkIndex,
        })
        const rejected = rejectionTarget
          ? review.rejectedTargets.some((candidate) =>
              isSameReviewTarget(candidate, rejectionTarget),
            )
          : false
        const canLoadRemainingContext =
          item.fileDiff.isPartial &&
          metadata.hunkIndex === item.fileDiff.hunks.length - 1 &&
          !contextExpansion.expandedFileKeys.has(metadata.fileKey)
        return (
          <ChangeReviewAction
            onKeep={() => changeReview.keep(target)}
            onReject={() => {
              if (rejectionTarget) startDraft(rejectionTarget, 'rejection')
            }}
            showReviewActions={!rejected}
            onLoadRemainingContext={
              canLoadRemainingContext ? () => contextExpansion.expand(target) : undefined
            }
          />
        )
      }
      return review.renderAnnotation(annotation)
    },
    [
      changeReview.keep,
      contextExpansion,
      fileIdentityByKey,
      review.rejectedTargets,
      review.renderAnnotation,
      startDraft,
    ],
  )

  const onGutterUtilityClick = useCallback(
    (range: SelectedLineRange, context: { item: CodeViewItem<GitOpsAnnotationMetadata> }) => {
      const identity = fileIdentityByKey.get(context.item.id)
      if (!identity) return
      const target = reviewTargetFromPierreSelection({ ...identity, range })
      if (target) startDraft(target)
    },
    [fileIdentityByKey, startDraft],
  )

  return { onGutterUtilityClick, onSelectedLinesChange, renderAnnotation, selectedLines }
}
