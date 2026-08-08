import { MessageSquarePlus, X } from 'lucide-react'
import {
  compactIconButtonClass,
  diffCommentAnnotationClass,
  toolbarButtonClass,
} from '../../../ui/classes'
import type { ReviewTarget } from './review-model'

function containPointerDown(event: React.PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function ReviewSelectionAction({
  onAddComment,
  onCancel,
  target,
}: {
  onAddComment: (target: ReviewTarget) => void
  onCancel: () => void
  target: ReviewTarget
}) {
  return (
    <div data-diff-comment-annotation="true" className={diffCommentAnnotationClass}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={toolbarButtonClass}
          onPointerDown={containPointerDown}
          onClick={(event) => {
            event.stopPropagation()
            onAddComment(target)
          }}
        >
          <MessageSquarePlus size={13} />
          Add comment
        </button>
        <button
          type="button"
          className={compactIconButtonClass}
          onPointerDown={containPointerDown}
          onClick={(event) => {
            event.stopPropagation()
            onCancel()
          }}
          aria-label="Clear line selection"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
