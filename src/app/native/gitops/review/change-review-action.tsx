import { toolbarButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import type { ChangeReviewDecision, ChangeReviewTarget } from './change-review-model'

function containPointerDown(event: React.PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function ChangeReviewAction({
  onResolve,
  target,
}: {
  onResolve: (target: ChangeReviewTarget, decision: ChangeReviewDecision) => void
  target: ChangeReviewTarget
}) {
  return (
    <div className="mr-3 mb-1.5 flex justify-end py-1" data-diff-change-action="true">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={toolbarButtonClass}
          onPointerDown={containPointerDown}
          onClick={(event) => {
            event.stopPropagation()
            onResolve(target, 'undo')
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className={cn(toolbarButtonClass, 'text-[color:var(--green)]')}
          onPointerDown={containPointerDown}
          onClick={(event) => {
            event.stopPropagation()
            onResolve(target, 'keep')
          }}
        >
          Keep
        </button>
      </div>
    </div>
  )
}
