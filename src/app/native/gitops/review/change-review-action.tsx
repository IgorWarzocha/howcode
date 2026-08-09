import { useEffect, useRef } from 'react'
import { toolbarButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import type { ChangeReviewDecision, ChangeReviewTarget } from './change-review-model'

function containPointerDown(event: React.PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
}

const trailingContextActionStyle = {
  color: 'var(--muted)',
  fontFamily: 'var(--diffs-header-font-family)',
} satisfies React.CSSProperties

export function ChangeReviewAction({
  busy,
  canUndo,
  onLoadRemainingContext,
  onResolve,
  target,
  undoing,
}: {
  busy: boolean
  canUndo: boolean
  onLoadRemainingContext?: (() => void) | undefined
  onResolve: (target: ChangeReviewTarget, decision: ChangeReviewDecision) => Promise<void>
  target: ChangeReviewTarget
  undoing: boolean
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
          className="cursor-pointer border-0 bg-transparent p-0 text-left hover:underline"
          style={trailingContextActionStyle}
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
        {canUndo ? (
          <button
            type="button"
            className={toolbarButtonClass}
            disabled={busy}
            onPointerDown={containPointerDown}
            onClick={(event) => {
              event.stopPropagation()
              void onResolve(target, 'undo')
            }}
          >
            {undoing ? 'Undoing…' : 'Undo'}
          </button>
        ) : null}
        <button
          type="button"
          className={cn(toolbarButtonClass, 'text-[color:var(--green)]')}
          disabled={busy}
          onPointerDown={containPointerDown}
          onClick={(event) => {
            event.stopPropagation()
            void onResolve(target, 'keep')
          }}
        >
          Keep
        </button>
      </div>
    </div>
  )
}
