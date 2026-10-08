import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from 'react'
import type { GitDetailPlacement, useGitDetailLayout } from './detail-layout'

type Operation = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
type Geometry = { left: number; top: number; width: number; height: number }
type Gesture = {
  operation: Operation
  frame: HTMLElement
  parent: HTMLElement
  content: HTMLElement | null
  contentStyle: string
  main: HTMLElement | null
  mainStyle: string
  mainHidden: HTMLElement['hidden']
  pointerX: number
  pointerY: number
  initial: Geometry
  current: Geometry
  frameStyle: string
  columns: string
  moved: boolean
  dock: GitDetailPlacement
  preview: HTMLElement | null
}
const directions: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}
const docks: Record<string, GitDetailPlacement> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'main',
  ArrowDown: 'floating',
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function resizeAxis(
  start: number,
  size: number,
  delta: number,
  extent: number,
  min: number,
  max: number,
  leading: boolean,
  trailing: boolean,
) {
  if (leading) {
    const end = start + size
    const next = clamp(start + delta, Math.max(0, end - max), end - Math.min(min, end))
    return { start: next, size: end - next }
  }
  return {
    start,
    size: trailing
      ? clamp(size + delta, Math.min(min, extent - start), Math.min(max, extent - start))
      : size,
  }
}

function restore(active: Gesture) {
  active.preview?.remove()
  active.frame.style.cssText = active.frameStyle
  active.parent.style.gridTemplateColumns = active.columns
  if (active.content) active.content.style.cssText = active.contentStyle
  if (active.main) {
    active.main.style.cssText = active.mainStyle
    active.main.hidden = active.mainHidden
  }
}

function previewDock(active: Gesture, x: number, y: number) {
  const bounds = active.parent.getBoundingClientRect()
  const inside = x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height
  active.dock = 'floating'
  if (inside) {
    if (x < 72) active.dock = 'left'
    else if (x > bounds.width - 72) active.dock = 'right'
    else if (y < 64) active.dock = 'main'
  }
  const preview = active.preview
  if (!preview) return
  preview.setAttribute('data-dock', active.dock)
  preview.textContent =
    active.dock === 'main' ? 'Main view' : active.dock === 'left' ? 'Left sidebar' : 'Right sidebar'
  preview.hidden = active.dock === 'floating'
}

/** Preview geometry imperatively; commit once, without replacing the mounted detail. */
export function useGitFrameInteraction({
  layout,
  updateLayout,
}: ReturnType<typeof useGitDetailLayout>) {
  const gesture = useRef<Gesture | null>(null)
  const floating = layout.placement === 'floating'
  useEffect(
    () => () => {
      if (gesture.current) restore(gesture.current)
    },
    [],
  )
  const begin = (element: HTMLElement, operation: Operation, x: number, y: number) => {
    const frame = element.closest('section')
    const parent = frame?.parentElement
    if (!(frame && parent)) return false
    const bounds = frame.getBoundingClientRect()
    const parentBounds = parent.getBoundingClientRect()
    if (operation !== 'move' && !floating && parentBounds.width <= 600) return false
    const initial = {
      left: bounds.left - parentBounds.left,
      top: bounds.top - parentBounds.top,
      width: bounds.width,
      height: bounds.height,
    }
    const main = parent.querySelector<HTMLElement>('main')
    const content = parent.querySelector<HTMLElement>(':scope > .domain-workspace-content-column')
    gesture.current = {
      operation,
      frame,
      parent,
      content,
      contentStyle: content?.style.cssText ?? '',
      main,
      mainStyle: main?.style.cssText ?? '',
      mainHidden: main?.hidden ?? false,
      pointerX: x,
      pointerY: y,
      initial,
      current: initial,
      frameStyle: frame.style.cssText,
      columns: parent.style.gridTemplateColumns,
      moved: false,
      dock: layout.placement,
      preview: null,
    }
    return true
  }
  const move = (active: Gesture, dx: number, dy: number) => {
    const bounds = active.parent.getBoundingClientRect()
    if (!active.moved) {
      if (Math.hypot(dx, dy) < 5) return
      active.moved = true
      const width = Math.min(layout.floatingWidth, bounds.width)
      const height = Math.min(layout.floatingHeight, bounds.height)
      const grabX = clamp(active.pointerX - bounds.left - active.initial.left, 0, width)
      active.initial = {
        left: active.pointerX - bounds.left - grabX,
        top:
          active.pointerY -
          bounds.top -
          Math.min(20, active.pointerY - bounds.top - active.initial.top),
        width,
        height,
      }
      active.preview = document.createElement('div')
      active.preview.className = 'git-detail-dock-preview'
      active.preview.setAttribute('aria-hidden', 'true')
      active.parent.append(active.preview)
      active.parent.style.gridTemplateColumns = 'minmax(0, 1fr)'
      if (active.content) active.content.style.gridColumn = '1'
      if (active.main) {
        active.main.style.gridColumn = '1'
        active.main.hidden = false
      }
      Object.assign(active.frame.style, {
        position: 'absolute',
        bottom: 'auto',
        zIndex: '30',
        boxShadow: 'var(--shadow)',
      })
    }
    active.current = {
      ...active.initial,
      left: clamp(active.initial.left + dx, 0, Math.max(0, bounds.width - active.initial.width)),
      top: clamp(active.initial.top + dy, 0, Math.max(0, bounds.height - active.initial.height)),
    }
    previewDock(active, active.pointerX + dx - bounds.left, active.pointerY + dy - bounds.top)
  }
  const preview = (dx: number, dy: number) => {
    const active = gesture.current
    if (!active) return
    const bounds = active.parent.getBoundingClientRect()
    if (active.operation === 'move') move(active, dx, dy)
    else if (floating) {
      const { initial, operation } = active
      const horizontal = resizeAxis(
        initial.left,
        initial.width,
        dx,
        bounds.width,
        280,
        1440,
        operation.includes('w'),
        operation.includes('e'),
      )
      const vertical = resizeAxis(
        initial.top,
        initial.height,
        dy,
        bounds.height,
        240,
        1000,
        operation.includes('n'),
        operation.includes('s'),
      )
      active.current = {
        left: horizontal.start,
        top: vertical.start,
        width: horizontal.size,
        height: vertical.size,
      }
    } else {
      const width = clamp(
        active.initial.width + (layout.placement === 'left' ? dx : -dx),
        280,
        Math.min(960, bounds.width * 0.65),
      )
      active.current = { ...active.initial, width }
      active.parent.style.gridTemplateColumns =
        layout.placement === 'left' ? `${width}px minmax(0, 1fr)` : `minmax(0, 1fr) ${width}px`
      return
    }
    const { left, top, width, height } = active.current
    Object.assign(active.frame.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    })
  }
  const finish = (commit: boolean) => {
    const active = gesture.current
    if (!active) return
    gesture.current = null
    restore(active)
    if (!commit || (active.operation === 'move' && !active.moved)) return
    if (active.operation !== 'move' && !floating) {
      updateLayout({ sidebarWidth: clamp(active.current.width, 280, 960) })
      return
    }
    const bounds = active.parent.getBoundingClientRect()
    const { left, top, width, height } = active.current
    const maxX = Math.max(0, bounds.width - width)
    const maxY = Math.max(0, bounds.height - height)
    updateLayout({
      placement: active.operation === 'move' ? active.dock : layout.placement,
      floatingWidth: clamp(width, 280, 1440),
      floatingHeight: clamp(height, 240, 1000),
      floatingX: maxX ? clamp((left / maxX) * 100, 0, 100) : layout.floatingX,
      floatingY: maxY ? clamp((top / maxY) * 100, 0, 100) : layout.floatingY,
    })
  }
  const moveWithKeyboard = (
    event: KeyboardEvent<HTMLElement>,
    direction: { x: number; y: number },
  ) => {
    const placement = docks[event.key]
    if (event.altKey && placement) {
      event.preventDefault()
      updateLayout({ placement })
    } else if (floating) {
      event.preventDefault()
      const step = event.shiftKey ? 1 : 5
      updateLayout({
        floatingX: clamp(layout.floatingX + direction.x * step, 0, 100),
        floatingY: clamp(layout.floatingY + direction.y * step, 0, 100),
      })
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, operation: Operation) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Escape' && gesture.current) {
      event.preventDefault()
      event.stopPropagation()
      finish(false)
      return
    }
    const direction = directions[event.key]
    if (!direction || gesture.current) return
    if (operation === 'move') {
      moveWithKeyboard(event, direction)
      return
    }
    if (!begin(event.currentTarget, operation, 0, 0)) return
    event.preventDefault()
    const step = event.shiftKey ? 1 : 20
    preview(direction.x * step, direction.y * step)
    finish(true)
  }
  return {
    handlers: (operation: Operation) => ({
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, operation),
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || !event.isPrimary || gesture.current) return
        const control =
          event.target instanceof Element
            ? event.target.closest(
                'button, select, input, textarea, a, [contenteditable], [role="button"]',
              )
            : null
        if (operation === 'move' && control && control !== event.currentTarget) return
        if (!begin(event.currentTarget, operation, event.clientX, event.clientY)) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const active = gesture.current
        if (active) preview(event.clientX - active.pointerX, event.clientY - active.pointerY)
      },
      onPointerUp: () => finish(true),
      onPointerCancel: () => finish(false),
      onLostPointerCapture: () => finish(false),
    }),
  }
}
