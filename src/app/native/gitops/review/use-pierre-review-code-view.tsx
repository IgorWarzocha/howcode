import type { CodeViewItem, CodeViewLineSelection, GetHoveredLineResult } from '@pierre/diffs'
import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { MessageSquarePlus } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Tooltip } from '../../../common/tooltip'
import { diffCommentGutterButtonClass } from '../../../ui/classes'
import {
  type ReviewAnnotationMetadata,
  reviewTargetFromPierreSelection,
  reviewTargetToPierreSelection,
} from './pierre-review-adapter'
import type { ReviewCodeViewController } from './review-code-view'
import { createLineRangeTarget } from './review-model'

export type ReviewFileIdentity = { fileKey: string; filePath: string }

export function usePierreReviewCodeView({
  fileIdentityByKey,
  review,
}: {
  fileIdentityByKey: ReadonlyMap<string, ReviewFileIdentity>
  review: ReviewCodeViewController
}) {
  const selectedLines = useMemo(() => {
    if (!review.draftTarget) return null
    const range = reviewTargetToPierreSelection(review.draftTarget)
    return range ? { id: review.draftTarget.fileKey, range } : null
  }, [review.draftTarget])

  const onSelectedLinesChange = useCallback(
    (selection: CodeViewLineSelection | null) => {
      if (!selection) {
        review.cancelDraft()
        return
      }
      const identity = fileIdentityByKey.get(selection.id)
      if (!identity) return
      const target = reviewTargetFromPierreSelection({ ...identity, range: selection.range })
      if (target) review.openDraft(target)
    },
    [fileIdentityByKey, review.cancelDraft, review.openDraft],
  )

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<ReviewAnnotationMetadata>) =>
      review.renderAnnotation(annotation),
    [review.renderAnnotation],
  )

  const renderGutterUtility = useCallback(
    (
      getHoveredLine: () => GetHoveredLineResult<'diff'> | undefined,
      item: CodeViewItem<ReviewAnnotationMetadata>,
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
              review.openDraft(
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
    [fileIdentityByKey, review.openDraft],
  )

  return { onSelectedLinesChange, renderAnnotation, renderGutterUtility, selectedLines }
}
