import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PointerEvent, ReactNode } from 'react'
import { useRef } from 'react'
import { chatRowShellClass } from './thread-layout'

const clampOneLineClass =
  'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]'
const clampTwoLinesClass =
  'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'
const clampThreeLinesClass =
  'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]'

export function FoldedTimelineRow({
  label,
  secondary,
  singleLine = false,
  italicLabel = false,
  mutedLabel = false,
  trailing,
  onToggle,
}: {
  label: string
  secondary?: string | null | undefined
  singleLine?: boolean | undefined
  italicLabel?: boolean | undefined
  mutedLabel?: boolean | undefined
  trailing?: ReactNode | undefined
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="grid w-full min-w-0 gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--message-tool-bg)] px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--surface-hover)]"
      onClick={onToggle}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={`min-w-0 flex-1 text-[13px] font-medium leading-[1.4] ${mutedLabel ? 'text-[color:var(--muted-2)]/90' : 'text-[color:var(--text)]/92'} ${italicLabel ? 'italic' : ''} ${singleLine || secondary || trailing ? clampOneLineClass : clampThreeLinesClass}`}
        >
          {label}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {secondary ? (
        <div
          className={`min-w-0 text-[12px] leading-[1.4] text-[color:var(--muted-2)]/90 ${clampTwoLinesClass}`}
        >
          {secondary}
        </div>
      ) : null}
    </button>
  )
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(
    target.closest('button, a, input, textarea, select, summary, [data-no-row-toggle="true"]'),
  )
}

function hasActiveTextSelectionWithin(container: Element) {
  const selection = window.getSelection?.()
  if (!selection || selection.isCollapsed) {
    return false
  }

  const anchorNode = selection.anchorNode
  const focusNode = selection.focusNode
  return (
    selection.toString().trim().length > 0 &&
    Boolean(anchorNode && container.contains(anchorNode)) &&
    Boolean(focusNode && container.contains(focusNode))
  )
}

export function RowLeadToggleSurface({
  onToggle,
  children,
}: {
  onToggle?: (() => void) | undefined
  children: ReactNode
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null)

  if (!onToggle) {
    return <>{children}</>
  }

  return (
    <div
      className="block w-full min-w-0 cursor-pointer text-left"
      ref={surfaceRef}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        pointerStartRef.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        }
      }}
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        if (isInteractiveTarget(event.target)) {
          return
        }

        const start = pointerStartRef.current
        pointerStartRef.current = null
        if (!start || start.id !== event.pointerId) {
          return
        }

        const deltaX = Math.abs(event.clientX - start.x)
        const deltaY = Math.abs(event.clientY - start.y)
        const surface = surfaceRef.current
        if (deltaX > 4 || deltaY > 4 || (surface && hasActiveTextSelectionWithin(surface))) {
          return
        }

        onToggle()
      }}
    >
      {children}
    </div>
  )
}

export function TimelineRowShell({
  expanded,
  ariaLabel,
  onToggle,
  toggleClassName,
  children,
}: {
  expanded?: boolean | undefined
  ariaLabel?: string | undefined
  onToggle?: (() => void) | undefined
  toggleClassName?: string | undefined
  children: ReactNode
}) {
  return (
    <div className={chatRowShellClass} data-row-toggle-anchor={onToggle ? 'true' : undefined}>
      {onToggle ? (
        <button
          type="button"
          className={`${toggleClassName ?? 'mt-1'} inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={ariaLabel}
          data-tooltip={ariaLabel}
          data-tooltip-align="start"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <div />
      )}
      <div className="min-w-0">{children}</div>
      <div />
    </div>
  )
}
