import { ArrowDownToLine, ListCollapse } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Message } from '../types'
import { appTypeSmallClass, compactIconButtonClass } from '../ui/classes'
import { WORKSPACE_RAIL_GRID_CLASS, WORKSPACE_RAIL_ROOT_CLASS } from '../ui/layout'
import { cn } from '../utils/cn'
import { buildTimelineRows } from './buildTimelineRows'
import { ThreadFindBar } from './thread-find-bar'
import { chatScrollableAreaClass } from './thread-layout'
import { getTimelineRowMessageIds } from './thread-message-ids'
import { ThreadTimelineRow } from './thread-timeline-row'
import { buildThreadTimelineState } from './thread-timeline-state'
import type { TimelineRow } from './timeline-row'
import { useSessionTreeReveal } from './useSessionTreeReveal'
import { useThreadFindNavigation } from './useThreadFindNavigation'
import { useThreadTimelineScroll } from './useThreadTimelineScroll'

type ThreadTimelineProps = {
  messages: Message[]
  previousMessageCount: number
  isStreaming: boolean
  isCompacting: boolean
  composerLayoutVersion: number
  composerOverlayHeight?: number
  sessionPath?: string | null | undefined
  onLoadEarlierMessages: () => void
  onLoadAroundMessage?: ((targetHistoryCompactions: number) => void) | undefined
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
  sessionPath,
  onLoadEarlierMessages,
  onLoadAroundMessage,
}: ThreadTimelineProps) {
  const [collapsedRowIds, setCollapsedRowIds] = useState<Record<string, boolean>>({})
  const [expandedToolGroupIds, setExpandedToolGroupIds] = useState<Record<string, boolean>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const programmaticScrollFrameRef = useRef<number | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const rows = useMemo<TimelineRow[]>(
    () => buildTimelineRows({ messages, previousMessageCount }),
    [messages, previousMessageCount],
  )

  const findRowStructureSignature = useMemo(
    () => rows.map((row) => `${row.id}:${getTimelineRowMessageIds(row).join(',')}`).join('|'),
    [rows],
  )

  const { activeFindMessageId, activeFindRowId, findQuery, revealFindMatch, setFindQuery } =
    useThreadFindNavigation({
      containerRef,
      onLoadAroundMessage,
      previousMessageCount,
      programmaticScrollFrameRef,
      rowStructureSignature: findRowStructureSignature,
      rows,
      setCollapsedRowIds,
      shouldStickToBottomRef,
    })

  useSessionTreeReveal({
    containerRef,
    programmaticScrollFrameRef,
    rowStructureSignature: findRowStructureSignature,
    rows,
    sessionPath,
    setCollapsedRowIds,
    shouldStickToBottomRef,
  })

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
        forcedExpandedRowId: activeFindRowId,
      }),
    [activeFindRowId, collapsedRowIds, isStreaming, messages, rows],
  )

  const {
    handleScroll,
    nearBottom,
    prepareForHistoryPrepend,
    scrollToBottom,
    stopFollowingBottom,
  } = useThreadTimelineScroll({
    bottomAnchorKey,
    composerLayoutVersion,
    composerOverlayHeight,
    containerRef,
    contentRef,
    programmaticScrollFrameRef,
    rowCount: rows.length,
    rowStructureSignature,
    shouldStickToBottomRef,
  })

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

      stopFollowingBottom()
      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }))
    },
    [stopFollowingBottom, streamingTurnRowId],
  )

  const handleToggleToolCallExpansion = stopFollowingBottom

  const handleToggleToolGroupExpansion = useCallback(
    (groupId: string) => {
      if (groupId === streamingToolGroupId) {
        return
      }

      stopFollowingBottom()
      setExpandedToolGroupIds((current) => ({
        ...current,
        [groupId]: !current[groupId],
      }))
    },
    [stopFollowingBottom, streamingToolGroupId],
  )

  const handleJumpToEarlierMessages = useCallback(() => {
    prepareForHistoryPrepend()
    onLoadEarlierMessages()
  }, [onLoadEarlierMessages, prepareForHistoryPrepend])

  const renderRow = useCallback(
    (row: TimelineRow) => (
      <div
        key={row.id}
        className="min-w-0"
        data-timeline-row-id={row.id}
        data-message-ids={getTimelineRowMessageIds(row).join(' ')}
      >
        <ThreadTimelineRow
          row={row}
          collapsed={Boolean(effectiveCollapsedRowIds[row.id])}
          activeFindMessageId={activeFindMessageId}
          findQuery={findQuery}
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
      activeFindMessageId,
      effectiveCollapsedRowIds,
      expandedToolGroupIds,
      findQuery,
      handleJumpToEarlierMessages,
      handleToggleRowCollapse,
      handleToggleToolCallExpansion,
      handleToggleToolGroupExpansion,
      streamingAssistantMessageId,
      streamingToolGroupId,
    ],
  )

  return (
    <div className={cn('relative h-full', WORKSPACE_RAIL_ROOT_CLASS)}>
      <ThreadFindBar
        sessionPath={sessionPath}
        onActiveMatchChange={revealFindMatch}
        onQueryChange={setFindQuery}
      />
      <div
        className={cn(
          'thread-timeline-viewport relative col-span-3 col-start-1 row-start-1 grid h-full min-w-0 overflow-visible',
          WORKSPACE_RAIL_GRID_CLASS,
        )}
      >
        <div
          ref={containerRef}
          className={cn(
            chatScrollableAreaClass,
            'thread-timeline-scroll-shell col-start-2 row-start-1 -ml-4 w-[calc(100%+1rem)] min-w-0',
          )}
          onScroll={handleScroll}
        >
          <div
            ref={contentRef}
            className="flex min-h-full w-full flex-col justify-end overflow-x-visible pt-0 pr-2 pb-4 pl-8"
            style={
              composerOverlayHeight > 0
                ? { paddingBottom: `calc(1rem + ${composerOverlayHeight}px)` }
                : undefined
            }
          >
            <div className="grid min-w-0 gap-3">{rows.map(renderRow)}</div>
            <div aria-hidden="true" className="h-px w-full" />
          </div>
        </div>
        <div className="pointer-events-none z-10 col-start-3 row-start-1 mb-4 flex w-7 flex-col items-center gap-1.5 self-end justify-self-center">
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
      {isCompacting ? (
        <div
          className="pointer-events-none absolute right-4 bottom-4 left-4 z-[5] flex justify-center"
          style={
            composerOverlayHeight > 0
              ? { bottom: `calc(1rem + ${composerOverlayHeight}px)` }
              : undefined
          }
        >
          <div
            className={cn(
              'thread-compaction-pill inline-flex h-7 max-w-none shrink-0 items-center gap-1.5 rounded-full px-3 text-[color:var(--accent)]',
              appTypeSmallClass,
            )}
          >
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[color:var(--accent)] opacity-70" />
            <span className="truncate">Compacting session context…</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
