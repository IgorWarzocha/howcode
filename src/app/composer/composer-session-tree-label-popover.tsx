import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ComposerSessionTreeLabelPopoverProps = {
  entryId: string
  label?: string | undefined
  open: boolean
  children: ReactNode
  onLabel: (entryId: string, label: string) => Promise<boolean> | boolean
  onOpenChange: (open: boolean) => void
}

export function ComposerSessionTreeLabelPopover({
  entryId,
  label = '',
  open,
  children,
  onLabel,
  onOpenChange,
}: ComposerSessionTreeLabelPopoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)
  const [draft, setDraft] = useState(label)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!open) setDraft(label)
  }, [label, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onOpenChange(false)
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && popoverRef.current?.contains(target)) return
      if (target instanceof Node && anchorRef.current?.contains(target)) return
      onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [onOpenChange, open])

  useLayoutEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      setPosition({ left: rect.left, top: rect.bottom + 2 })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const submit = async () => {
    const nextLabel = draft.trim()
    if (nextLabel === label.trim()) {
      onOpenChange(false)
      return
    }
    const ok = await onLabel(entryId, nextLabel)
    if (ok) onOpenChange(false)
  }

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <span
            ref={popoverRef}
            className="composer-session-tree-entry-label-popover"
            style={{
              left: `${position?.left ?? 0}px`,
              top: `${position?.top ?? 0}px`,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') void submit()
                if (event.key === 'Escape') onOpenChange(false)
              }}
              placeholder="Label entry"
              aria-label="Tree entry label"
              className="composer-session-tree-label-input"
            />
            <button
              type="button"
              className="sidebar-icon-action sidebar-icon-action--sm composer-session-tree-entry-label-save"
              aria-label="Save label"
              onClick={(event) => {
                event.stopPropagation()
                void submit()
              }}
            >
              <Check size={11} />
            </button>
          </span>,
          document.body,
        )
      : null

  return (
    <span ref={anchorRef} className="composer-session-tree-entry-label-anchor">
      {children}
      {popover}
    </span>
  )
}
