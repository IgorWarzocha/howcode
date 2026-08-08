import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { Check, X } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
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
import type { ReviewAnnotationMetadata } from './pierre-review-adapter'
import { describeReviewTarget, type ReviewDraft } from './review-model'

type ReviewAnnotationCardProps = {
  annotation: DiffLineAnnotation<ReviewAnnotationMetadata>
  draftCardRef: RefObject<HTMLDivElement | null>
  draftComment: ReviewDraft | null
  setDraftComment: Dispatch<SetStateAction<ReviewDraft | null>>
  onPersistDraftComment: () => void
  onRemoveComment: (commentId: string) => void
}

export function ReviewAnnotationCard({
  annotation,
  draftCardRef,
  draftComment,
  setDraftComment,
  onPersistDraftComment,
  onRemoveComment,
}: ReviewAnnotationCardProps) {
  const metadata = annotation.metadata

  if (metadata.kind === 'draft') {
    return (
      <div
        ref={draftCardRef}
        data-diff-comment-annotation="true"
        className={diffCommentAnnotationClass}
      >
        <div className="flex items-center justify-between gap-2">
          <div className={cn('min-w-0 truncate', appTypeMetaStrongClass, appToneMutedClass)}>
            Add comment ·{' '}
            {draftComment ? describeReviewTarget(draftComment.target) : 'Line comment'}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip content="Cancel comment">
              <button
                type="button"
                className={compactIconButtonClass}
                onClick={(event) => {
                  event.stopPropagation()
                  setDraftComment(null)
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
                  onPersistDraftComment()
                }}
                disabled={(draftComment?.body.trim().length ?? 0) === 0}
                aria-label="Save comment"
              >
                <Check size={14} />
              </button>
            </Tooltip>
          </div>
        </div>
        <textarea
          className={diffCommentTextareaClass}
          value={draftComment?.body ?? ''}
          onChange={(event) => {
            setDraftComment((current) =>
              current ? { ...current, body: event.target.value } : current,
            )
          }}
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
              onRemoveComment(metadata.id)
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
