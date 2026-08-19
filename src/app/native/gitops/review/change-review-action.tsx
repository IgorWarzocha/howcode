import { useEffect, useRef } from 'react'
import { toolbarButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

function containPointerDown(event: React.PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
}

const trailingContextActionStyle = {
  color: 'var(--muted)',
  fontFamily: 'var(--diffs-header-font-family)',
} satisfies React.CSSProperties

export function ChangeReviewAction({
  onLoadRemainingContext,
  onKeep,
  onReject,
  showReviewActions,
}: {
  onLoadRemainingContext?: (() => void) | undefined
  onKeep: () => void
  onReject: () => void
  showReviewActions: boolean
}) {
  const actionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!onLoadRemainingContext) return
    const diffContainer = actionRef.current?.closest('diffs-container')
    diffContainer?.setAttribute('data-gitops-trailing-context-action', '')
    return () => diffContainer?.removeAttribute('data-gitops-trailing-context-action')
  }, [onLoadRemainingContext])

  if (!(onLoadRemainingContext || showReviewActions)) return null

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
      {showReviewActions ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolbarButtonClass}
            onPointerDown={containPointerDown}
            onClick={(event) => {
              event.stopPropagation()
              onReject()
            }}
          >
            Reject
          </button>
          <button
            type="button"
            className={cn(toolbarButtonClass, 'text-[color:var(--green)]')}
            onPointerDown={containPointerDown}
            onClick={(event) => {
              event.stopPropagation()
              onKeep()
            }}
          >
            Keep
          </button>
        </div>
      ) : null}
    </div>
  )
}
