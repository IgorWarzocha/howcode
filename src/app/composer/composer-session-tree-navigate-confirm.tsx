import { Tooltip } from '@howcode/common/tooltip'
import { ListCollapse, Undo2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { cn } from '../utils/cn'

type ComposerSessionTreeNavigateConfirmProps = {
  open: boolean
  trigger: ReactNode
  onCancel: () => void
  onNavigateWithoutSummary: () => void
  onNavigateWithSummary: () => void
}

export function ComposerSessionTreeNavigateConfirm({
  open,
  trigger,
  onCancel,
  onNavigateWithoutSummary,
  onNavigateWithSummary,
}: ComposerSessionTreeNavigateConfirmProps) {
  const popunderRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onCancel()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && popunderRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.composer-session-tree-inline-anchor')) {
        return
      }
      onCancel()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [onCancel, open])

  return (
    <span className={cn('tooltip-anchor composer-session-tree-inline-anchor')}>
      {trigger}
      {open ? (
        <span
          ref={popunderRef}
          className="sidebar-inline-action-strip sidebar-inline-popunder composer-session-tree-inline-popunder"
          data-action-count="3"
          data-confirming="true"
        >
          <Tooltip content="Cancel" placement="top">
            <button
              type="button"
              className="sidebar-icon-action sidebar-icon-action--sm sidebar-inline-action-button sidebar-inline-popunder-button"
              onClick={(event) => {
                event.stopPropagation()
                onCancel()
              }}
              aria-label="Cancel"
            >
              <X size={12} />
            </button>
          </Tooltip>
          <Tooltip content="Go without summary" placement="top">
            <button
              type="button"
              className="sidebar-icon-action sidebar-icon-action--sm sidebar-inline-action-button sidebar-inline-popunder-button"
              onClick={(event) => {
                event.stopPropagation()
                onNavigateWithoutSummary()
              }}
              aria-label="Go without summary"
            >
              <Undo2 size={12} />
            </button>
          </Tooltip>
          <Tooltip content="Summarize branch" placement="top">
            <button
              type="button"
              className="sidebar-icon-action sidebar-icon-action--sm sidebar-inline-action-button sidebar-inline-popunder-button sidebar-inline-action-button--danger"
              onClick={(event) => {
                event.stopPropagation()
                onNavigateWithSummary()
              }}
              aria-label="Summarize branch"
            >
              <ListCollapse size={12} />
            </button>
          </Tooltip>
        </span>
      ) : null}
    </span>
  )
}
