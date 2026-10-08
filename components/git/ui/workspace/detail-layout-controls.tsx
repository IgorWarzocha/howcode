import { Move } from 'lucide-react'
import { useRef } from 'react'
import { appTypeMetaClass, compactIconButtonClass } from '../../../../src/app/ui/classes'
import { cn } from '../../../../src/app/utils/cn'
import { isGitDetailPlacement, type useGitDetailLayout } from './detail-layout'

const positionKeys: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

export function GitDetailLayoutControls({
  layout,
  updateLayout,
  persistenceError,
}: ReturnType<typeof useGitDetailLayout>) {
  const floating = layout.placement === 'floating'
  const drag = useRef<{
    frame: HTMLElement
    pointerX: number
    pointerY: number
    left: number
    top: number
    originalLeft: string
    originalTop: string
  } | null>(null)
  const finishDrag = (commit: boolean) => {
    const active = drag.current
    if (!active) return
    drag.current = null
    const parent = active.frame.parentElement
    const bounds = parent?.getBoundingClientRect()
    const frameBounds = active.frame.getBoundingClientRect()
    if (commit && bounds) {
      const maxX = Math.max(0, bounds.width - frameBounds.width)
      const maxY = Math.max(0, bounds.height - frameBounds.height)
      updateLayout({
        floatingX: maxX
          ? Math.min(100, Math.max(0, ((frameBounds.left - bounds.left) / maxX) * 100))
          : layout.floatingX,
        floatingY: maxY
          ? Math.min(100, Math.max(0, ((frameBounds.top - bounds.top) / maxY) * 100))
          : layout.floatingY,
      })
    }
    active.frame.style.left = active.originalLeft
    active.frame.style.top = active.originalTop
  }
  return (
    <header
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[color:var(--border)] px-3 py-2',
        appTypeMetaClass,
      )}
    >
      {floating ? (
        <button
          type="button"
          className={cn(compactIconButtonClass, 'touch-none cursor-move')}
          aria-label="Move floating Git frame"
          title="Drag to move; use arrow keys for position"
          onKeyDown={(event) => {
            const step = event.shiftKey ? 1 : 10
            if (event.key === 'Escape') {
              finishDrag(false)
              return
            }
            const direction = positionKeys[event.key]
            if (!direction) return
            event.preventDefault()
            updateLayout({
              floatingX: Math.max(0, Math.min(100, layout.floatingX + direction.x * step)),
              floatingY: Math.max(0, Math.min(100, layout.floatingY + direction.y * step)),
            })
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return
            const frame = event.currentTarget.closest('section')
            const parent = frame?.parentElement
            if (!(frame && parent)) return
            const bounds = frame.getBoundingClientRect()
            const parentBounds = parent.getBoundingClientRect()
            drag.current = {
              frame,
              pointerX: event.clientX,
              pointerY: event.clientY,
              left: bounds.left - parentBounds.left,
              top: bounds.top - parentBounds.top,
              originalLeft: frame.style.left,
              originalTop: frame.style.top,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const active = drag.current
            const parent = active?.frame.parentElement
            if (!(active && parent)) return
            const bounds = parent.getBoundingClientRect()
            const frameBounds = active.frame.getBoundingClientRect()
            active.frame.style.left = `${Math.max(0, Math.min(bounds.width - frameBounds.width, active.left + event.clientX - active.pointerX))}px`
            active.frame.style.top = `${Math.max(0, Math.min(bounds.height - frameBounds.height, active.top + event.clientY - active.pointerY))}px`
          }}
          onPointerUp={() => finishDrag(true)}
          onPointerCancel={() => finishDrag(false)}
          onLostPointerCapture={() => finishDrag(false)}
        >
          <Move size={14} />
        </button>
      ) : null}
      <label className="flex items-center gap-2">
        <span>Git</span>
        <select
          aria-label="Git placement"
          className="min-w-0 rounded-md border border-[color:var(--border)] bg-[color:var(--panel)] px-2 py-1 text-[color:var(--text)]"
          value={layout.placement}
          onChange={(event) => {
            const placement = event.target.value
            if (isGitDetailPlacement(placement)) updateLayout({ placement })
          }}
        >
          <option value="main">Main view</option>
          <option value="left">Left sidebar</option>
          <option value="right">Right sidebar</option>
          <option value="floating">Floating frame</option>
        </select>
      </label>
      {layout.placement === 'main' ? null : (
        <label className="flex items-center gap-2">
          <span>Width</span>
          <input
            type="range"
            aria-label="Git width"
            className="w-20 accent-[var(--accent)]"
            min={280}
            max={floating ? 1440 : 960}
            step={20}
            value={floating ? layout.floatingWidth : layout.sidebarWidth}
            onChange={(event) =>
              updateLayout(
                floating
                  ? { floatingWidth: Number(event.target.value) }
                  : { sidebarWidth: Number(event.target.value) },
              )
            }
          />
        </label>
      )}
      {floating ? (
        <label className="flex items-center gap-2">
          <span>Height</span>
          <input
            type="range"
            aria-label="Git height"
            className="w-20 accent-[var(--accent)]"
            min={240}
            max={1000}
            step={20}
            value={layout.floatingHeight}
            onChange={(event) => updateLayout({ floatingHeight: Number(event.target.value) })}
          />
        </label>
      ) : null}
      {persistenceError ? <p role="status">{persistenceError}</p> : null}
    </header>
  )
}
