import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { Check, X } from 'lucide-react'
import type { RefObject } from 'react'
import { Tooltip } from '../../../common/tooltip'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeMetaStrongClass,
  appTypeSmallClass,
  compactIconButtonClass,
  diffCommentAnnotationClass,
  diffCommentSaveButtonClass,
  diffCommentTextareaClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { type GitOpsAnnotationMetadata, getReviewAnnotation } from './pierre-review-adapter'
import { describeReviewTarget, type ReviewDraft, type ReviewTarget } from './review-model'
import { ReviewSelectionAction } from './review-selection-action'

export type ReviewAnnotationController = {
  comments: { remove: (commentId: string) => void }
  draft: {
    cancel: () => void
    cardRef: RefObject<HTMLDivElement | null>
    comment: ReviewDraft | null
    persist: () => void
    setBody: (body: string) => void
  }
  selection: {
    addComment: (target: ReviewTarget) => void
    cancel: () => void
  }
}

export function ReviewAnnotationCard({
  annotation,
  controller,
}: {
  annotation: DiffLineAnnotation<GitOpsAnnotationMetadata>
  controller: ReviewAnnotationController
}) {
  const metadata = getReviewAnnotation(annotation)
  if (!metadata) return null

  if (metadata.kind === 'selection-action') {
    return (
      <ReviewSelectionAction
        target={metadata.target}
        onAddComment={controller.selection.addComment}
        onCancel={controller.selection.cancel}
      />
    )
  }

  if (metadata.kind === 'draft') {
    return (
      <div
        ref={controller.draft.cardRef}
        data-diff-comment-annotation="true"
        className={diffCommentAnnotationClass}
      >
        <div className="flex items-center justify-between gap-2">
          <div className={cn('min-w-0 truncate', appTypeMetaStrongClass, appToneMutedClass)}>
            Add comment ·{' '}
            {controller.draft.comment
              ? describeReviewTarget(controller.draft.comment.target)
              : 'Line comment'}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip content="Cancel comment">
              <button
                type="button"
                className={compactIconButtonClass}
                onClick={(event) => {
                  event.stopPropagation()
                  controller.draft.cancel()
                }}
                aria-label="Cancel comment"
              >
                <X size={14} />
              </button>
            </Tooltip>
            <Tooltip content="Save comment">
              <button
                type="button"
                className={diffCommentSaveButtonClass}
                onClick={(event) => {
                  event.stopPropagation()
                  controller.draft.persist()
                }}
                disabled={(controller.draft.comment?.body.trim().length ?? 0) === 0}
                aria-label="Save comment"
              >
                <Check size={14} />
              </button>
            </Tooltip>
          </div>
        </div>
        <textarea
          className={diffCommentTextareaClass}
          value={controller.draft.comment?.body ?? ''}
          onChange={(event) => controller.draft.setBody(event.target.value)}
          aria-label={`Comment for line ${annotation.lineNumber}`}
        />
      </div>
    )
  }

  return (
    <div
      data-saved-diff-comment-id={metadata.id}
      data-diff-comment-annotation="true"
      className={diffCommentAnnotationClass}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2',
          appTypeMetaStrongClass,
          appToneMutedClass,
        )}
      >
        <span>Comment · {describeReviewTarget(metadata.target)}</span>
        <Tooltip content="Remove comment">
          <button
            type="button"
            className={compactIconButtonClass}
            onClick={(event) => {
              event.stopPropagation()
              controller.comments.remove(metadata.id)
            }}
            aria-label="Remove comment"
          >
            <X size={12} />
          </button>
        </Tooltip>
      </div>
      <p className={cn('m-0 whitespace-pre-wrap px-0.5', appTypeSmallClass, appToneTextClass)}>
        {metadata.body}
      </p>
    </div>
  )
}
