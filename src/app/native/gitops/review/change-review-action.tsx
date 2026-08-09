import { useEffect, useRef } from 'react'
import { toolbarButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import type { ChangeReviewDecision, ChangeReviewTarget } from './change-review-model'

function containPointerDown(event: React.PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function ChangeReviewAction({
  onLoadRemainingContext,
  onResolve,
  target,
}: {
  onLoadRemainingContext?: (() => void) | undefined
  onResolve: (target: ChangeReviewTarget, decision: ChangeReviewDecision) => void
  target: ChangeReviewTarget
}) {
  const actionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!onLoadRemainingContext) return
    const diffContainer = actionRef.current?.closest('diffs-container')
    diffContainer?.setAttribute('data-gitops-trailing-context-action', '')
    return () => diffContainer?.removeAttribute('data-gitops-trailing-context-action')
  }, [onLoadRemainingContext])

  return (
    <div
      ref={actionRef}
      className={cn(
        'mr-3 mb-1.5 flex items-center py-1',
        onLoadRemainingContext ? 'justify-between' : 'justify-end',
      )}
      data-diff-change-action="true"
    >
      {onLoadRemainingContext ? (
        <button
          type="button"
          className={toolbarButtonClass}
          data-load-remaining-context="true"
          onPointerDown={containPointerDown}
          onClick={(event) => {
            event.stopPropagation()
            onLoadRemainingContext()
          }}
        >
          Load remaining context
        </button>
      ) : null}
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
