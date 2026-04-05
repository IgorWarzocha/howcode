import { measureElement as measureVirtualElement, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import { ThreadTimelineRow } from "./ThreadTimelineRow";
import { ThreadTimelineRows } from "./ThreadTimelineRows";
import { buildTimelineRows } from "./buildTimelineRows";
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX } from "./chat-scroll";
import { estimateThreadTimelineRowHeight } from "./estimateThreadTimelineRowHeight";
import { reconcileCollapsedRowIds } from "./reconcileCollapsedRowIds";
import { chatScrollableAreaClass, chatViewportClass } from "./thread-layout";
import { getCollapsibleRowKey } from "./thread-timeline-signatures";
import type { TimelineRow } from "./timeline-row";
import { useThreadTimelineScrollController } from "./useThreadTimelineScrollController";
import { useTimelineWidth } from "./useTimelineWidth";
import { buildVirtualizedThreadTimelineState } from "./virtualized-thread-timeline.helpers";

type VirtualizedThreadTimelineProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
  composerLayoutVersion: number;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onLoadEarlierMessages: () => void;
};

export function VirtualizedThreadTimeline({
  messages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
  composerLayoutVersion,
  onOpenTurnDiff,
  onLoadEarlierMessages,
}: VirtualizedThreadTimelineProps) {
  const [expandedDiffTrees, setExpandedDiffTrees] = useState<Record<number, boolean>>({});
  const [collapsedRowIds, setCollapsedRowIds] = useState<Record<string, boolean>>({});
  const [expandedToolGroupIds, setExpandedToolGroupIds] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<TimelineRow[]>(
    () => buildTimelineRows({ messages, previousMessageCount, turnDiffSummaries }),
    [messages, previousMessageCount, turnDiffSummaries],
  );
  const timelineWidthPx = useTimelineWidth(timelineRootRef);
  const {
    bottomAnchorKey,
    effectiveCollapsedRowIds,
    foldableRows,
    latestTurnRowId,
    rowStructureSignature,
    streamingAssistantMessageId,
    streamingToolGroupId,
    streamingTurnRowId,
    virtualMeasureSignature,
    virtualizedRowCount,
  } = useMemo(
    () =>
      buildVirtualizedThreadTimelineState({
        rows,
        messages,
        isStreaming,
        collapsedRowIds,
        expandedToolGroupIds,
        expandedDiffTrees,
        timelineWidthPx,
      }),
    [
      collapsedRowIds,
      expandedDiffTrees,
      expandedToolGroupIds,
      isStreaming,
      messages,
      rows,
      timelineWidthPx,
    ],
  );
  const getVirtualRowKey = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) {
        return index;
      }

      return getCollapsibleRowKey(row, effectiveCollapsedRowIds);
    },
    [effectiveCollapsedRowIds, rows],
  );

  const rowVirtualizer = useVirtualizer({
    count: virtualizedRowCount,
    getScrollElement: () => containerRef.current,
    getItemKey: getVirtualRowKey,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row) {
        return 96;
      }

      return estimateThreadTimelineRowHeight({
        row,
        collapsed: Boolean(effectiveCollapsedRowIds[row.id]),
        expandedToolGroupIds,
        expandedDiffTrees,
        streamingAssistantMessageId,
        streamingToolGroupId,
        timelineWidthPx,
      });
    },
    measureElement: measureVirtualElement,
    useAnimationFrameWithResizeObserver: true,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const nonVirtualizedRows = rows.slice(virtualizedRowCount);

  const {
    handleJumpToEarlierMessages,
    handlePointerCancel,
    handlePointerDown,
    handlePointerUp,
    handleScroll,
    handleScrollClickCapture,
    handleToggleDiffTree,
    handleToggleRowCollapse,
    handleToggleToolCallExpansion,
    handleToggleToolGroupExpansion,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    handleWheel,
  } = useThreadTimelineScrollController({
    bottomAnchorKey,
    bottomSentinelRef,
    composerLayoutVersion,
    containerRef,
    effectiveCollapsedRowIds,
    onLoadEarlierMessages,
    rowStructureSignature,
    rowVirtualizer,
    rowsLength: rows.length,
    setCollapsedRowIds,
    setExpandedDiffTrees,
    setExpandedToolGroupIds,
    streamingToolGroupId,
    streamingTurnRowId,
    timelineRootRef,
    virtualMeasureSignature,
  });

  useEffect(() => {
    setCollapsedRowIds((current) => {
      const next = reconcileCollapsedRowIds(foldableRows, current, {
        defaultExpandedRowId: latestTurnRowId,
        forcedExpandedRowId: streamingTurnRowId,
      });

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }

      return next;
    });
  }, [foldableRows, latestTurnRowId, streamingTurnRowId]);

  const renderRow = useCallback(
    (row: TimelineRow) => (
      <div className="min-w-0 pb-4" data-timeline-row-id={row.id}>
        <ThreadTimelineRow
          row={row}
          collapsed={Boolean(effectiveCollapsedRowIds[row.id])}
          streamingAssistantMessageId={streamingAssistantMessageId}
          streamingToolGroupId={streamingToolGroupId}
          expandedToolGroupIds={expandedToolGroupIds}
          expandedDiffTrees={expandedDiffTrees}
          onToggleRowCollapse={handleToggleRowCollapse}
          onToggleToolCallExpansion={handleToggleToolCallExpansion}
          onToggleToolGroupExpansion={handleToggleToolGroupExpansion}
          onToggleDiffTree={handleToggleDiffTree}
          onOpenTurnDiff={onOpenTurnDiff}
          onJumpToEarlierMessages={handleJumpToEarlierMessages}
        />
      </div>
    ),
    [
      effectiveCollapsedRowIds,
      expandedDiffTrees,
      expandedToolGroupIds,
      handleJumpToEarlierMessages,
      handleToggleDiffTree,
      handleToggleRowCollapse,
      handleToggleToolCallExpansion,
      handleToggleToolGroupExpansion,
      onOpenTurnDiff,
      streamingToolGroupId,
      streamingAssistantMessageId,
    ],
  );

  return (
    <div className={chatViewportClass}>
      <div
        ref={containerRef}
        className={chatScrollableAreaClass}
        onScroll={handleScroll}
        onClickCapture={handleScrollClickCapture}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          ref={timelineRootRef}
          className="mx-auto w-full min-w-0 max-w-[744px] overflow-x-hidden px-4 pt-4 pb-8"
        >
          <ThreadTimelineRows
            rows={rows}
            totalSize={rowVirtualizer.getTotalSize()}
            virtualRows={virtualRows}
            nonVirtualizedRows={nonVirtualizedRows}
            measureElement={rowVirtualizer.measureElement}
            renderRow={renderRow}
          />

          <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
        </div>
      </div>
    </div>
  );
}
