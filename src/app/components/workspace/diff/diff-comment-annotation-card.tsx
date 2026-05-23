import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { Check, X } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
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
import { type DiffCommentMetadata, describeCommentTarget } from './diff-panel-content.helpers'
import type { DiffCommentDraft } from './diffCommentStore'

type DiffCommentAnnotationCardProps = {
  annotation: DiffLineAnnotation<DiffCommentMetadata>
  draftCardRef: RefObject<HTMLDivElement | null>
  draftComment: DiffCommentDraft | null
  setDraftComment: Dispatch<SetStateAction<DiffCommentDraft | null>>
  onPersistDraftComment: () => void
  onRemoveComment: (commentId: string) => void
}

export function DiffCommentAnnotationCard({
  annotation,
  draftCardRef,
  draftComment,
  setDraftComment,
  onPersistDraftComment,
  onRemoveComment,
}: DiffCommentAnnotationCardProps) {
  const metadata = annotation.metadata

  if (metadata.kind === 'draft') {
    return (
      <div ref={draftCardRef} className={diffCommentAnnotationClass}>
        <div className="flex items-center justify-between gap-2">
          <div className={cn('min-w-0 truncate', appTypeMetaStrongClass, appToneMutedClass)}>
            Add comment · {draftComment ? describeCommentTarget(draftComment) : 'Line comment'}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={compactIconButtonClass}
              onClick={() => {
                setDraftComment(null)
              }}
              aria-label="Cancel comment"
              data-tooltip="Cancel comment"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              className={diffCommentSaveButtonClass}
              onClick={onPersistDraftComment}
              disabled={(draftComment?.body.trim().length ?? 0) === 0}
              aria-label="Save comment"
              data-tooltip="Save comment"
            >
              <Check size={14} />
            </button>
          </div>
        </div>
        <textarea
          className={diffCommentTextareaClass}
          value={draftComment?.body ?? ''}
          onChange={(event) => {
            setDraftComment((current) =>
              current
                ? {
                    ...current,
                    body: event.target.value,
                  }
                : current,
            )
          }}
          aria-label={`Comment for line ${annotation.lineNumber}`}
        />
      </div>
    )
  }

  return (
    <div data-saved-diff-comment-id={metadata.id} className={diffCommentAnnotationClass}>
      <div
        className={cn(
          'flex items-center justify-between gap-2',
          appTypeMetaStrongClass,
          appToneMutedClass,
        )}
      >
        <span>Comment · {describeCommentTarget(metadata)}</span>
        <button
          type="button"
          className={compactIconButtonClass}
          onClick={() => onRemoveComment(metadata.id)}
          aria-label="Remove comment"
          data-tooltip="Remove comment"
        >
          <X size={12} />
        </button>
      </div>
      <p className={cn('m-0 whitespace-pre-wrap px-0.5', appTypeSmallClass, appToneTextClass)}>
        {metadata.body}
      </p>
    </div>
  )
}
