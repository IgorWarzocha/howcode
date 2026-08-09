import type { CodeViewItem, CodeViewLineSelection, GetHoveredLineResult } from '@pierre/diffs'
import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { MessageSquarePlus } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Tooltip } from '../../../common/tooltip'
import { diffCommentGutterButtonClass } from '../../../ui/classes'
import { ChangeReviewAction } from './change-review-action'
import type { ChangeReviewTarget } from './change-review-model'
import {
  type GitOpsAnnotationMetadata,
  reviewTargetFromPierreSelection,
  reviewTargetToPierreSelection,
} from './pierre-review-adapter'
import type { ReviewCodeViewController } from './review-code-view'
import { createLineRangeTarget } from './review-model'
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

  const renderGutterUtility = useCallback(
    (
      getHoveredLine: () => GetHoveredLineResult<'diff'> | undefined,
      item: CodeViewItem<GitOpsAnnotationMetadata>,
    ) => {
      const hoveredLine = getHoveredLine()
      const identity = fileIdentityByKey.get(item.id)
      if (!(hoveredLine && identity)) return null
      return (
        <Tooltip content="Add comment">
          <button
            type="button"
            className={diffCommentGutterButtonClass}
            onPointerDownCapture={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              startDraft(
                createLineRangeTarget({
                  ...identity,
                  side: hoveredLine.side,
                  lineNumber: hoveredLine.lineNumber,
                }),
              )
            }}
            aria-label={`Add comment on ${identity.filePath}:${hoveredLine.lineNumber}`}
          >
            <MessageSquarePlus size={12} />
          </button>
        </Tooltip>
      )
    },
    [fileIdentityByKey, startDraft],
  )

  return { onSelectedLinesChange, renderAnnotation, renderGutterUtility, selectedLines }
}
