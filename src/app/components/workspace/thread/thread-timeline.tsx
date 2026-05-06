import { ArrowDownToLine, ListCollapse } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Message } from '../../../types'
import { compactIconButtonClass } from '../../../ui/classes'
import { CHAT_TEXT_MAX_WIDTH_CLASS } from '../../../ui/layout'
import { cn } from '../../../utils/cn'
import { buildTimelineRows } from './buildTimelineRows'
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX, isScrollContainerNearBottom } from './chat-scroll'
import { chatScrollableAreaClass, chatViewportClass } from './thread-layout'
import { ThreadTimelineRow } from './thread-timeline-row'
import { buildThreadTimelineState } from './thread-timeline-state'
import type { TimelineRow } from './timeline-row'

type ThreadTimelineProps = {
  messages: Message[]
  previousMessageCount: number
  isStreaming: boolean
  isCompacting: boolean
  composerLayoutVersion: number
  composerOverlayHeight?: number
  onLoadEarlierMessages: () => void
}

const timelineQuickActionButtonClass =
  'pointer-events-auto h-6 w-6 shrink-0 rounded-full bg-[color:var(--panel-2)] hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-45'

export function ThreadTimeline({
  messages,
  previousMessageCount,
  isStreaming,
  isCompacting,
  composerLayoutVersion,
  composerOverlayHeight = 0,
  onLoadEarlierMessages,
}: ThreadTimelineProps) {
  const [collapsedRowIds, setCollapsedRowIds] = useState<Record<string, boolean>>({})
  const [expandedToolGroupIds, setExpandedToolGroupIds] = useState<Record<string, boolean>>({})
  const [nearBottom, setNearBottom] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const programmaticScrollFrameRef = useRef<number | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const pendingHistoryPrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null)

  const rows = useMemo<TimelineRow[]>(
    () => buildTimelineRows({ messages, previousMessageCount }),
    [messages, previousMessageCount],
  )

  const {
    bottomAnchorKey,
    effectiveCollapsedRowIds,
    foldableRows,
    latestTurnRowId,
    rowStructureSignature,
    streamingAssistantMessageId,
    streamingToolGroupId,
    streamingTurnRowId,
  } = useMemo(
    () =>
      buildThreadTimelineState({
        rows,
        messages,
        isStreaming,
        collapsedRowIds,
        expandedToolGroupIds,
      }),
    [collapsedRowIds, expandedToolGroupIds, isStreaming, messages, rows],
  )

  useEffect(() => {
    setCollapsedRowIds((current) => {
      const next = foldableRows.reduce<Record<string, boolean>>((result, row) => {
        if (row.id === streamingTurnRowId) {
          result[row.id] = false
          return result
        }

        if (Object.hasOwn(current, row.id)) {
          result[row.id] = current[row.id] as boolean
          return result
        }

        result[row.id] = row.id !== latestTurnRowId
        return result
      }, {})

      const currentKeys = Object.keys(current)
      const nextKeys = Object.keys(next)
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === next[key])
      ) {
        return current
      }

      return next
    })
  }, [foldableRows, latestTurnRowId, streamingTurnRowId])

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (programmaticScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(programmaticScrollFrameRef.current)
    }

    container.scrollTop = container.scrollHeight
    shouldStickToBottomRef.current = true
    setNearBottom(true)
    programmaticScrollFrameRef.current = window.requestAnimationFrame(() => {
      programmaticScrollFrameRef.current = null
    })
  }, [])

  useEffect(
    () => () => {
      if (programmaticScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(programmaticScrollFrameRef.current)
      }
    },
    [],
  )

  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!(container && content) || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      if (shouldStickToBottomRef.current) {
        scrollToBottom()
      }
    })

    observer.observe(container)
    observer.observe(content)

    return () => {
      observer.disconnect()
    }
  }, [scrollToBottom])

  useLayoutEffect(() => {
    void bottomAnchorKey
    void composerLayoutVersion
    void composerOverlayHeight
    void rowStructureSignature

    const container = containerRef.current
    if (!container) {
      return
    }

    const pendingHistoryPrepend = pendingHistoryPrependRef.current
    if (pendingHistoryPrepend) {
      const delta = container.scrollHeight - pendingHistoryPrepend.scrollHeight
      container.scrollTop = pendingHistoryPrepend.scrollTop + Math.max(0, delta)
      pendingHistoryPrependRef.current = null
      return
    }

    if (rows.length === 0) {
      return
    }

    if (shouldStickToBottomRef.current) {
      scrollToBottom()
    }
  }, [
    bottomAnchorKey,
    composerLayoutVersion,
    composerOverlayHeight,
    rowStructureSignature,
    rows.length,
    scrollToBottom,
  ])

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (programmaticScrollFrameRef.current !== null) {
      return
    }

    const nextNearBottom = isScrollContainerNearBottom(
      {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
      },
      CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
    )
    shouldStickToBottomRef.current = nextNearBottom
    setNearBottom(nextNearBottom)
  }, [])

  const handleFoldEverything = useCallback(() => {
    shouldStickToBottomRef.current = true
    setExpandedToolGroupIds({})
    setCollapsedRowIds(
      foldableRows.reduce<Record<string, boolean>>((nextCollapsedRowIds, row) => {
        nextCollapsedRowIds[row.id] = row.id !== streamingTurnRowId
        return nextCollapsedRowIds
      }, {}),
    )
    window.requestAnimationFrame(scrollToBottom)
  }, [foldableRows, scrollToBottom, streamingTurnRowId])

  const handleToggleRowCollapse = useCallback(
    (rowId: string) => {
      if (rowId === streamingTurnRowId) {
        return
      }

      shouldStickToBottomRef.current = false
      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }))
    },
    [streamingTurnRowId],
  )

  const handleToggleToolCallExpansion = useCallback(() => {
    shouldStickToBottomRef.current = false
  }, [])

  const handleToggleToolGroupExpansion = useCallback(
    (groupId: string) => {
      if (groupId === streamingToolGroupId) {
        return
      }

      shouldStickToBottomRef.current = false
      setExpandedToolGroupIds((current) => ({
        ...current,
        [groupId]: !current[groupId],
      }))
    },
    [streamingToolGroupId],
  )

  const handleJumpToEarlierMessages = useCallback(() => {
    const container = containerRef.current
    if (container) {
      pendingHistoryPrependRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      }
    }

    shouldStickToBottomRef.current = false
    onLoadEarlierMessages()
  }, [onLoadEarlierMessages])

  const renderRow = useCallback(
    (row: TimelineRow) => (
      <div key={row.id} className="min-w-0" data-timeline-row-id={row.id}>
        <ThreadTimelineRow
          row={row}
          collapsed={Boolean(effectiveCollapsedRowIds[row.id])}
          streamingAssistantMessageId={streamingAssistantMessageId}
          streamingToolGroupId={streamingToolGroupId}
          expandedToolGroupIds={expandedToolGroupIds}
          onToggleRowCollapse={handleToggleRowCollapse}
          onToggleToolCallExpansion={handleToggleToolCallExpansion}
          onToggleToolGroupExpansion={handleToggleToolGroupExpansion}
          onJumpToEarlierMessages={handleJumpToEarlierMessages}
        />
      </div>
    ),
    [
      effectiveCollapsedRowIds,
      expandedToolGroupIds,
      handleJumpToEarlierMessages,
      handleToggleRowCollapse,
      handleToggleToolCallExpansion,
      handleToggleToolGroupExpansion,
      streamingAssistantMessageId,
      streamingToolGroupId,
    ],
  )

  return (
    <div className={`${chatViewportClass} relative`}>
      <div
        ref={containerRef}
        className={cn(chatScrollableAreaClass, 'ml-[2.95rem] mr-[2.05rem]')}
        onScroll={handleScroll}
      >
        <div
          ref={contentRef}
          className={`mx-auto flex min-h-full w-full min-w-0 flex-col justify-end ${CHAT_TEXT_MAX_WIDTH_CLASS} overflow-x-hidden px-4 pt-4 pb-4`}
          style={
            composerOverlayHeight > 0
              ? { paddingBottom: `calc(1rem + ${composerOverlayHeight}px)` }
              : undefined
          }
        >
          <div className="grid min-w-0 gap-4">{rows.map(renderRow)}</div>
          <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
        </div>
      </div>
      {isCompacting ? (
        <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-20 flex justify-center">
          <div className="rounded-full border border-[color:var(--accent-border)] bg-[color:var(--panel)] px-3 py-2 text-[13px] text-[color:var(--accent)] shadow-[var(--shadow)]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent)]" />
              <span>Compacting session context…</span>
            </div>
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute right-0 bottom-4 z-10 flex w-7 flex-col items-center gap-1.5">
        <button
          type="button"
          className={cn(compactIconButtonClass, timelineQuickActionButtonClass)}
          onClick={handleFoldEverything}
          disabled={foldableRows.length === 0}
          aria-label="Fold all"
          data-tooltip="Fold all"
        >
          <ListCollapse size={13} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={cn(compactIconButtonClass, timelineQuickActionButtonClass)}
          onClick={scrollToBottom}
          disabled={nearBottom}
          aria-label="Scroll to bottom"
          data-tooltip="Scroll to bottom"
        >
          <ArrowDownToLine size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
