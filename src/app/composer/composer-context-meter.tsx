import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react'
import { PopoverPanel } from '../common/popover'
import type { ComposerContextUsage } from '../desktop/types'
import { useDismissibleLayer } from '../hooks/useDismissibleLayer'
import type { Message } from '../types'
import {
  appToneAccentClass,
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeCodeClass,
  appTypeMetaClass,
  appTypeSmallClass,
  composerPopoverContextLayerClass,
} from '../ui/classes'
import { cn } from '../utils/cn'

type ComposerContextMeterProps = {
  contextUsage: ComposerContextUsage | null
  dismissSignal?: number | undefined
  messages?: Message[] | undefined
  isCompacting: boolean
  compactDisabled: boolean
  onCompact: () => void
  onPreviewOpen?: (() => void) | undefined
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

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Unknown'
  return `${value.toFixed(1)}%`
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
  dismissSignal,
  messages,
  isCompacting,
  compactDisabled,
  onCompact,
  onPreviewOpen,
}: ComposerContextMeterProps) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [usageTotals, setUsageTotals] = useState<UsageTotals | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const clearHoverTriangleRef = useRef<(() => void) | null>(null)
  const lastDismissSignalRef = useRef(dismissSignal)
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
    onPreviewOpen?.()
    loadUsageTotals()
    setHovered(true)
  }, [clearHoverTriangle, loadUsageTotals, onPreviewOpen])

  const closeHoverPreview = useCallback(() => {
    clearHoverTriangle()
    setHovered(false)
  }, [clearHoverTriangle])

  const togglePinned = useCallback(() => {
    loadUsageTotals()
    setPinned((current) => !current)
  }, [loadUsageTotals])

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

  useEffect(() => {
    if (dismissSignal === lastDismissSignalRef.current) return
    lastDismissSignalRef.current = dismissSignal
    clearHoverTriangle()
    setHovered(false)
    setPinned(false)
  }, [clearHoverTriangle, dismissSignal])

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
        onClick={togglePinned}
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
        // Passive hover preview: keep above composer-adjacent extension UI.
        <PopoverPanel
          surface={false}
          ref={popoverRef}
          role="dialog"
          className={cn(
            'absolute bottom-full left-0 grid w-56 gap-2 rounded-xl bg-[color:var(--panel)] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.34)]',
            composerPopoverContextLayerClass,
            appTypeSmallClass,
            appToneMutedClass,
          )}
          onMouseEnter={openHoverPreview}
          onMouseDown={(event) => event.preventDefault()}
        >
          {usageTotals ? (
            <div className="grid gap-1 border-b border-[color:var(--border)] pb-2">
              <div className="flex justify-between gap-4">
                <span>Tokens</span>
                <span className={cn(appTypeCodeClass, appToneTextClass)}>
                  {formatTokens(usageTotals.totalTokens)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Input</span>
                <span className={cn(appTypeCodeClass, appToneTextClass)}>
                  {formatTokens(usageTotals.input)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Output</span>
                <span className={cn(appTypeCodeClass, appToneTextClass)}>
                  {formatTokens(usageTotals.output)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Cache read</span>
                <span className={cn(appTypeCodeClass, appToneTextClass)}>
                  {formatTokens(usageTotals.cacheRead)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Cache write</span>
                <span className={cn(appTypeCodeClass, appToneTextClass)}>
                  {formatTokens(usageTotals.cacheWrite)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Cost</span>
                <span className={cn(appTypeCodeClass, appToneTextClass)}>
                  {formatCost(usageTotals.costTotal)}
                </span>
              </div>
            </div>
          ) : null}
          <div className="grid gap-1">
            <div className="flex justify-between gap-3">
              <span>Used</span>
              <span className={cn(appTypeCodeClass, appToneTextClass)}>{formatTokens(tokens)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Available</span>
              <span className={cn(appTypeCodeClass, appToneTextClass)}>
                {formatTokens(availableTokens)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Window</span>
              <span className={cn(appTypeCodeClass, appToneTextClass)}>
                {formatTokens(contextWindow)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Usage</span>
              <span className={cn(appTypeCodeClass, appToneTextClass)}>
                {formatPercent(percent)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Latest cache hit</span>
              <span className={cn(appTypeCodeClass, appToneTextClass)}>
                {formatPercent(contextUsage?.latestCacheHitRate)}
              </span>
            </div>
          </div>
          {tokens === null ? (
            <div className={cn(appTypeMetaClass, appToneSubtleClass)}>
              Usage is unknown until the next response updates token stats.
            </div>
          ) : null}
          {isCompacting ? (
            <div
              className={cn(
                'mt-1 inline-flex h-7 items-center justify-center rounded-md bg-[color:var(--surface-hover)] px-2.5',
                appTypeMetaClass,
                appToneAccentClass,
              )}
            >
              Compacting session context…
            </div>
          ) : (
            <button
              type="button"
              className={cn(
                'mt-1 inline-flex h-7 items-center justify-center rounded-md px-2.5 transition-colors hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:text-[color:var(--muted-2)] disabled:opacity-55',
                appTypeSmallClass,
                appToneTextClass,
              )}
              disabled={compactDisabled}
              onClick={() => {
                if (compactDisabled) {
                  return
                }

                onCompact()
              }}
            >
              Compact
            </button>
          )}
        </PopoverPanel>
      ) : null}
    </div>
  )
}
