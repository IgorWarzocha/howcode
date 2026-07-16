import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { cn } from '../../utils/cn'

type SidebarInlineConfirmPopunderProps = {
  open: boolean
  trigger: ReactNode
  confirmAriaLabel: string
  confirmIcon: ReactNode
  onCancel: () => void
  onConfirm: () => void
  className?: string | undefined
  confirmButtonClassName?: string | undefined
}

export function SidebarInlineConfirmPopunder({
  open,
  trigger,
  confirmAriaLabel,
  confirmIcon,
  onCancel,
  onConfirm,
  className,
  confirmButtonClassName,
}: SidebarInlineConfirmPopunderProps) {
  const popunderRef = useRef<HTMLSpanElement>(null)
  const cancel = useEffectEvent(onCancel)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      cancel()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && popunderRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.sidebar-inline-popunder-anchor')) return
      cancel()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [open])

  return (
    <span className={cn('tooltip-anchor sidebar-inline-popunder-anchor', className)}>
      {trigger}
      {open ? (
        <span
          ref={popunderRef}
          className="sidebar-inline-action-strip sidebar-inline-popunder"
          data-action-count="2"
          data-confirming="true"
        >
          <span className="tooltip-anchor">
            <button
              type="button"
              className="sidebar-icon-action sidebar-icon-action--sm sidebar-inline-action-button sidebar-inline-popunder-button"
              onClick={(event) => {
                event.stopPropagation()
                onCancel()
              }}
              aria-label="Dismiss confirmation"
            >
              <X size={12} />
            </button>
          </span>
          <span className="tooltip-anchor">
            <button
              type="button"
              className={cn(
                'sidebar-icon-action sidebar-icon-action--sm sidebar-inline-action-button sidebar-inline-popunder-button sidebar-inline-action-button--danger',
                confirmButtonClassName,
              )}
              onClick={(event) => {
                event.stopPropagation()
                onConfirm()
              }}
              aria-label={confirmAriaLabel}
            >
              {confirmIcon}
            </button>
          </span>
        </span>
      ) : null}
    </span>
  )
}
