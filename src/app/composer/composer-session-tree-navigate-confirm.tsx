import { Tooltip } from '@howcode/common/tooltip'
import { ListCollapse, Undo2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils/cn'

type ComposerSessionTreeNavigateConfirmProps = {
  open: boolean
  trigger: ReactNode
  onCancel: () => void
  onNavigateWithoutSummary: (label?: string) => void
  onNavigateWithSummary: (label?: string) => void
}

export function ComposerSessionTreeNavigateConfirm({
  open,
  trigger,
  onCancel,
  onNavigateWithoutSummary,
  onNavigateWithSummary,
}: ComposerSessionTreeNavigateConfirmProps) {
  const popunderRef = useRef<HTMLSpanElement>(null)
  const labelPopunderRef = useRef<HTMLSpanElement>(null)
  const [label, setLabel] = useState('')
  const [labelFieldVisible, setLabelFieldVisible] = useState(false)
  const [labelPosition, setLabelPosition] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)

  const showLabelField = () => setLabelFieldVisible(true)
  const submitNavigate = (summarize: boolean) => {
    const trimmedLabel = label.trim()
    if (summarize) onNavigateWithSummary(trimmedLabel || undefined)
    else onNavigateWithoutSummary(trimmedLabel || undefined)
  }

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
      if (target instanceof Node && labelPopunderRef.current?.contains(target)) return
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

  useEffect(() => {
    if (open) return
    setLabel('')
    setLabelFieldVisible(false)
    setLabelPosition(null)
  }, [open])

  const labelVisible = labelFieldVisible || Boolean(label.trim())

  useLayoutEffect(() => {
    if (!(open && labelVisible)) return

    const updatePosition = () => {
      const strip = popunderRef.current
      if (!strip) return
      const rect = strip.getBoundingClientRect()
      const width = rect.width * 1.5
      setLabelPosition({
        left: rect.left + rect.width / 2 - width / 2,
        top: rect.bottom + 2,
        width,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [labelVisible, open])

  const labelPopunder =
    labelVisible && labelPosition && typeof document !== 'undefined'
      ? createPortal(
          <span
            ref={labelPopunderRef}
            className="composer-session-tree-label-popunder composer-session-tree-label-popunder--portal"
            style={{
              left: `${labelPosition.left}px`,
              top: `${labelPosition.top}px`,
              width: `${labelPosition.width}px`,
            }}
          >
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Escape') onCancel()
              }}
              placeholder="Label branch"
              aria-label="Branch label"
              className="composer-session-tree-label-input"
            />
          </span>,
          document.body,
        )
      : null

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
              onMouseEnter={showLabelField}
              onFocus={showLabelField}
              onClick={(event) => {
                event.stopPropagation()
                submitNavigate(false)
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
              onMouseEnter={showLabelField}
              onFocus={showLabelField}
              onClick={(event) => {
                event.stopPropagation()
                submitNavigate(true)
              }}
              aria-label="Summarize branch"
            >
              <ListCollapse size={12} />
            </button>
          </Tooltip>
        </span>
      ) : null}
      {labelPopunder}
    </span>
  )
}
