import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { ComposerContextUsage } from '../../../desktop/types'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Message } from '../../../types'
import { ghostButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

type ComposerContextMeterProps = {
  contextUsage: ComposerContextUsage | null
  messages?: Message[] | undefined
  isCompacting: boolean
  compactDisabled: boolean
  onCompact: () => void
}

const tokenFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const numberFormatter = new Intl.NumberFormat('en')
const costFormatter = new Intl.NumberFormat('en', {
  currency: 'USD',
  maximumFractionDigits: 4,
  style: 'currency',
})

type UsageTotals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  costTotal: number
  count: number
}

function formatTokens(value: number | null | undefined, options: { compact?: boolean } = {}) {
  if (value === null || value === undefined) {
    return 'Unknown'
  }

  return options.compact ? tokenFormatter.format(value) : numberFormatter.format(value)
}

function formatCost(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Unknown'
  return costFormatter.format(value)
}

function getMessageUsageTotals(messages: Message[] | undefined): UsageTotals | null {
  if (!messages || messages.length === 0) return null

  const totals: UsageTotals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    costTotal: 0,
    count: 0,
  }

  for (const message of messages) {
    if (message.role !== 'assistant' || !message.usage) continue
    totals.input += message.usage.input
    totals.output += message.usage.output
    totals.cacheRead += message.usage.cacheRead
    totals.cacheWrite += message.usage.cacheWrite
    totals.totalTokens += message.usage.totalTokens
    totals.costTotal += message.usage.costTotal
    totals.count += 1
  }

  return totals.count === 0 ? null : totals
}

function getMeterTone(percent: number | null | undefined) {
  if (percent === null || percent === undefined) {
    return 'var(--muted)'
  }

  if (percent > 90) {
    return 'var(--danger)'
  }

  if (percent > 70) {
    return 'var(--warning)'
  }

  return 'var(--accent)'
}

type Point = {
  x: number
  y: number
}

function getTriangleArea(a: Point, b: Point, c: Point) {
  return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2)
}

function isPointInTriangle(point: Point, a: Point, b: Point, c: Point) {
  const area = getTriangleArea(a, b, c)
  const areaA = getTriangleArea(point, b, c)
  const areaB = getTriangleArea(a, point, c)
  const areaC = getTriangleArea(a, b, point)

  return Math.abs(area - (areaA + areaB + areaC)) < 0.5
}

function isPointInExpandedRect(point: Point, rect: DOMRect, padding: number) {
  return (
    point.x >= rect.left - padding &&
    point.x <= rect.right + padding &&
    point.y >= rect.top - padding &&
    point.y <= rect.bottom + padding
  )
}

function getContextUsageValues(contextUsage: ComposerContextUsage | null) {
  const percent = contextUsage?.percent ?? null
  const tokens = contextUsage?.tokens ?? null
  const contextWindow = contextUsage?.contextWindow ?? null
  return {
    availableTokens:
      tokens !== null && contextWindow !== null ? Math.max(0, contextWindow - tokens) : null,
    contextWindow,
    meterPercent: percent === null ? 0 : Math.max(0, Math.min(100, percent)),
    percent,
    tokens,
  }
}

function getContextMeterLabel(isCompacting: boolean, percent: number | null | undefined) {
  if (isCompacting) return 'Compacting context'
  if (percent === null || percent === undefined) return 'Context unknown'
  return `${percent.toFixed(0)}% context`
}

function shouldKeepContextPopoverHovered(input: {
  buttonRect: DOMRect
  origin: Point
  point: Point
  popoverRect: DOMRect
}) {
  const padding = 10
  return (
    isPointInExpandedRect(input.point, input.popoverRect, padding) ||
    isPointInExpandedRect(input.point, input.buttonRect, padding) ||
    isPointInTriangle(
      input.point,
      input.origin,
      { x: input.popoverRect.left - padding, y: input.popoverRect.bottom + padding },
      { x: input.popoverRect.right + padding, y: input.popoverRect.bottom + padding },
    )
  )
}

function createHoverTriangleCleanup(input: {
  buttonRect: DOMRect
  closeHoverPreview: () => void
  origin: Point
  popoverRect: DOMRect
  setHovered: (hovered: boolean) => void
}) {
  const handlePointerMove = (pointerEvent: PointerEvent) => {
    const point = { x: pointerEvent.clientX, y: pointerEvent.clientY }
    if (shouldKeepContextPopoverHovered({ ...input, point })) {
      input.setHovered(true)
      return
    }
    input.closeHoverPreview()
  }
  const timeout = window.setTimeout(input.closeHoverPreview, 900)
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  return () => {
    window.clearTimeout(timeout)
    window.removeEventListener('pointermove', handlePointerMove)
  }
}

export function ComposerContextMeter({
  contextUsage,
  messages,
  isCompacting,
  compactDisabled,
  onCompact,
}: ComposerContextMeterProps) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [usageTotals, setUsageTotals] = useState<UsageTotals | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const clearHoverTriangleRef = useRef<(() => void) | null>(null)
  const { availableTokens, contextWindow, meterPercent, percent, tokens } =
    getContextUsageValues(contextUsage)
  const tone = getMeterTone(percent)
  const open = hovered || pinned
  const label = getContextMeterLabel(isCompacting, percent)

  useDismissibleLayer({
    open: pinned,
    onDismiss: () => setPinned(false),
    refs: [buttonRef, popoverRef],
  })

  const clearHoverTriangle = useCallback(() => {
    clearHoverTriangleRef.current?.()
    clearHoverTriangleRef.current = null
  }, [])

  const loadUsageTotals = useCallback(() => {
    setUsageTotals(getMessageUsageTotals(messages))
  }, [messages])

  const openHoverPreview = useCallback(() => {
    clearHoverTriangle()
    loadUsageTotals()
    setHovered(true)
  }, [clearHoverTriangle, loadUsageTotals])

  const closeHoverPreview = useCallback(() => {
    clearHoverTriangle()
    setHovered(false)
  }, [clearHoverTriangle])

  const handleMouseLeave = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (pinned) {
        return
      }

      const button = buttonRef.current
      const popover = popoverRef.current
      if (!(button && popover)) {
        closeHoverPreview()
        return
      }

      clearHoverTriangle()

      clearHoverTriangleRef.current = createHoverTriangleCleanup({
        buttonRect: button.getBoundingClientRect(),
        closeHoverPreview,
        origin: { x: event.clientX, y: event.clientY },
        popoverRect: popover.getBoundingClientRect(),
        setHovered,
      })
    },
    [clearHoverTriangle, closeHoverPreview, pinned],
  )

  useEffect(() => clearHoverTriangle, [clearHoverTriangle])
  return (
    <div
      role="application"
      className="composer-context-control relative"
      onMouseEnter={openHoverPreview}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        className="relative inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
        onClick={() => setPinned((current) => !current)}
        onPointerDown={loadUsageTotals}
        aria-label={label}
        aria-expanded={open}
      >
        <span
          className={cn('absolute inset-[7px] rounded-full', isCompacting && 'animate-pulse')}
          style={{
            background: `conic-gradient(${tone} ${meterPercent * 3.6}deg, var(--border-strong) 0deg)`,
          }}
        />
        <span className="absolute inset-[11px] rounded-full bg-[color:var(--panel)]" />
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          className="absolute bottom-full left-0 z-[130] grid w-56 gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--panel)] p-3 text-[12px] text-[color:var(--muted)] shadow-[var(--shadow)]"
          onMouseEnter={openHoverPreview}
          onMouseDown={(event) => event.preventDefault()}
        >
          {usageTotals ? (
            <div className="grid gap-1 border-b border-[color:var(--border)] pb-2">
              <div className="flex justify-between gap-4">
                <span>Tokens</span>
                <span className="font-mono text-[color:var(--text)]">
                  {formatTokens(usageTotals.totalTokens)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Input</span>
                <span className="font-mono text-[color:var(--text)]">
                  {formatTokens(usageTotals.input)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Output</span>
                <span className="font-mono text-[color:var(--text)]">
                  {formatTokens(usageTotals.output)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Cache read</span>
                <span className="font-mono text-[color:var(--text)]">
                  {formatTokens(usageTotals.cacheRead)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Cache write</span>
                <span className="font-mono text-[color:var(--text)]">
                  {formatTokens(usageTotals.cacheWrite)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Cost</span>
                <span className="font-mono text-[color:var(--text)]">
                  {formatCost(usageTotals.costTotal)}
                </span>
              </div>
            </div>
          ) : null}
          <div className="grid gap-1">
            <div className="flex justify-between gap-3">
              <span>Used</span>
              <span className="font-mono text-[color:var(--text)]">{formatTokens(tokens)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Available</span>
              <span className="font-mono text-[color:var(--text)]">
                {formatTokens(availableTokens)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Window</span>
              <span className="font-mono text-[color:var(--text)]">
                {formatTokens(contextWindow)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Usage</span>
              <span className="font-mono text-[color:var(--text)]">
                {percent === null || percent === undefined ? 'Unknown' : `${percent.toFixed(1)}%`}
              </span>
            </div>
          </div>
          {tokens === null ? (
            <div className="text-[11px] text-[color:var(--muted-2)]">
              Usage is unknown until the next response updates token stats.
            </div>
          ) : null}
          {isCompacting ? (
            <div className="rounded-lg border border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)] px-2 py-1.5 text-[11px] text-[color:var(--accent)]">
              Compacting session context…
            </div>
          ) : null}
          <button
            type="button"
            className={cn(
              ghostButtonClass,
              'mt-1 justify-center border-[color:var(--border)] text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-45',
            )}
            disabled={compactDisabled}
            onClick={() => {
              if (compactDisabled) {
                return
              }

              setHovered(false)
              setPinned(false)
              onCompact()
            }}
          >
            Compact
          </button>
        </div>
      ) : null}
    </div>
  )
}
