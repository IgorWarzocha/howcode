import type { CodeViewItem, CodeViewLineSelection, SelectedLineRange } from '@pierre/diffs'
import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { useCallback, useMemo } from 'react'
import { ChangeReviewAction } from './change-review-action'
import type { ChangeReviewTarget } from './change-review-model'
import {
  type GitOpsAnnotationMetadata,
  reviewTargetFromPierreSelection,
  reviewTargetToPierreSelection,
} from './pierre-review-adapter'
import type { ReviewCodeViewController } from './review-code-view'
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
        const target = { fileKey: metadata.fileKey, hunkIndex: metadata.hunkIndex }
        const canLoadRemainingContext =
          item.type === 'diff' &&
          item.fileDiff.isPartial &&
          metadata.hunkIndex === item.fileDiff.hunks.length - 1 &&
          !contextExpansion.expandedFileKeys.has(metadata.fileKey)
        return (
          <ChangeReviewAction
            target={target}
            onResolve={changeReview.resolve}
            onLoadRemainingContext={
              canLoadRemainingContext ? () => contextExpansion.expand(target) : undefined
            }
          />
        )
      }
      return review.renderAnnotation(annotation)
    },
    [changeReview.resolve, contextExpansion, review.renderAnnotation],
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
