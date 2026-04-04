import { measureElement as measureVirtualElement, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import { ThreadTimelineRow } from "./ThreadTimelineRow";
import { buildTimelineRows } from "./buildTimelineRows";
import { estimateThreadTimelineRowHeight } from "./estimateThreadTimelineRowHeight";
import { reconcileCollapsedRowIds } from "./reconcileCollapsedRowIds";
import {
  CHAT_BOTTOM_PADDING_PX,
  CHAT_ROW_GAP_PX,
  CHAT_STICKY_BOTTOM_THRESHOLD_PX,
  CHAT_TOP_PADDING_PX,
  chatScrollableAreaClass,
  chatViewportClass,
} from "./thread-layout";
import {
  getCollapsibleRowKey,
  getFoldableRows,
  getMessageRenderSignature,
  getRowStructureSignature,
  getStreamingAssistantMessageId,
  getStreamingToolGroupId,
} from "./thread-timeline-signatures";
import type { TimelineRow } from "./timeline-row";

type VirtualizedThreadTimelineProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onLoadEarlierMessages: () => void;
};

export function VirtualizedThreadTimeline({
  messages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
  onOpenTurnDiff,
  onLoadEarlierMessages,
}: VirtualizedThreadTimelineProps) {
  const [expandedDiffTrees, setExpandedDiffTrees] = useState<Record<number, boolean>>({});
  const [collapsedRowIds, setCollapsedRowIds] = useState<Record<string, boolean>>({});
  const [expandedToolGroupIds, setExpandedToolGroupIds] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const pendingHistoryPrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const suppressAutoScrollRef = useRef(false);
  const suppressAutoScrollTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const timelineWidthRef = useRef<number | null>(null);

  const rows = useMemo<TimelineRow[]>(
    () => buildTimelineRows({ messages, previousMessageCount, turnDiffSummaries }),
    [messages, previousMessageCount, turnDiffSummaries],
  );
  const bottomAnchorKey = useMemo(
    () =>
      `${getMessageRenderSignature(messages[messages.length - 1])}:${isStreaming ? "streaming" : "idle"}`,
    [isStreaming, messages],
  );
  const streamingAssistantMessageId = useMemo(
    () => getStreamingAssistantMessageId(messages, isStreaming),
    [isStreaming, messages],
  );
  const streamingToolGroupId = useMemo(
    () => getStreamingToolGroupId(rows, messages, isStreaming),
    [isStreaming, messages, rows],
  );
  const foldableRows = useMemo(() => getFoldableRows(rows), [rows]);
  const latestTurnRowId = useMemo(
    () => [...rows].reverse().find((row) => row.kind === "turn")?.id ?? null,
    [rows],
  );
  const streamingTurnRowId = useMemo(() => {
    if (!isStreaming) {
      return null;
    }

    return (
      rows.find(
        (row) =>
          row.kind === "turn" &&
          row.items.some(
            (item) => item.kind === "message" && item.message.id === streamingAssistantMessageId,
          ),
      )?.id ?? latestTurnRowId
    );
  }, [isStreaming, latestTurnRowId, rows, streamingAssistantMessageId]);
  const effectiveCollapsedRowIds = useMemo(
    () =>
      reconcileCollapsedRowIds(foldableRows, collapsedRowIds, {
        defaultExpandedRowId: latestTurnRowId,
        forcedExpandedRowId: streamingTurnRowId,
      }),
    [collapsedRowIds, foldableRows, latestTurnRowId, streamingTurnRowId],
  );
  const rowStructureSignature = useMemo(
    () => getRowStructureSignature(rows, effectiveCollapsedRowIds),
    [effectiveCollapsedRowIds, rows],
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
    count: rows.length,
    getScrollElement: () => containerRef.current,
    getItemKey: getVirtualRowKey,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row) {
        return CHAT_TOP_PADDING_PX + CHAT_BOTTOM_PADDING_PX;
      }

      return estimateThreadTimelineRowHeight({
        row,
        collapsed: Boolean(effectiveCollapsedRowIds[row.id]),
        expandedToolGroupIds,
        expandedDiffTrees,
        streamingAssistantMessageId,
        streamingToolGroupId,
      });
    },
    measureElement: measureVirtualElement,
    useAnimationFrameWithResizeObserver: true,
    overscan: 10,
    paddingStart: CHAT_TOP_PADDING_PX,
    paddingEnd: CHAT_BOTTOM_PADDING_PX,
    gap: CHAT_ROW_GAP_PX,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

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

  const scrollToBottom = useCallback(() => {
    if (!rows.length) {
      return;
    }

    rowVirtualizer.scrollToIndex(rows.length - 1, { align: "end" });
  }, [rowVirtualizer, rows.length]);

  const scheduleScrollToBottom = useCallback(() => {
    if (!shouldStickToBottomRef.current || suppressAutoScrollRef.current) {
      return;
    }

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollToBottom();
      scrollFrameRef.current = null;
    });
  }, [scrollToBottom]);

  const suppressAutoScrollTemporarily = useCallback(() => {
    suppressAutoScrollRef.current = true;

    if (suppressAutoScrollTimerRef.current !== null) {
      window.clearTimeout(suppressAutoScrollTimerRef.current);
    }

    suppressAutoScrollTimerRef.current = window.setTimeout(() => {
      suppressAutoScrollRef.current = false;
      suppressAutoScrollTimerRef.current = null;
    }, 180);
  }, []);

  useLayoutEffect(() => {
    void bottomAnchorKey;
    void rowStructureSignature;

    rowVirtualizer.measure();

    const container = containerRef.current;
    const pendingHistoryPrepend = pendingHistoryPrependRef.current;

    if (container && pendingHistoryPrepend) {
      const delta = container.scrollHeight - pendingHistoryPrepend.scrollHeight;
      container.scrollTop = pendingHistoryPrepend.scrollTop + Math.max(0, delta);
      pendingHistoryPrependRef.current = null;
      return;
    }

    if (!rows.length) {
      return;
    }

    scheduleScrollToBottom();
  }, [bottomAnchorKey, rowStructureSignature, rowVirtualizer, rows.length, scheduleScrollToBottom]);

  useEffect(() => {
    rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = (_item, _delta, instance) => {
      const viewportHeight = instance.scrollRect?.height ?? 0;
      const scrollOffset = instance.scrollOffset ?? 0;
      const remainingDistance = instance.getTotalSize() - (scrollOffset + viewportHeight);

      return remainingDistance > CHAT_STICKY_BOTTOM_THRESHOLD_PX;
    };

    return () => {
      rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    };
  }, [rowVirtualizer]);

  useEffect(() => {
    const container = containerRef.current;
    const timelineRoot = timelineRootRef.current;
    if (!container || !timelineRoot || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = timelineRoot.getBoundingClientRect().width;
      if (
        timelineWidthRef.current === null ||
        Math.abs(timelineWidthRef.current - nextWidth) >= 0.5
      ) {
        timelineWidthRef.current = nextWidth;
        rowVirtualizer.measure();
      }

      scheduleScrollToBottom();
    });

    timelineWidthRef.current = timelineRoot.getBoundingClientRect().width;
    resizeObserver.observe(container);
    resizeObserver.observe(timelineRoot);

    return () => {
      resizeObserver.disconnect();
    };
  }, [rowVirtualizer, scheduleScrollToBottom]);

  useEffect(() => {
    return () => {
      if (suppressAutoScrollTimerRef.current !== null) {
        window.clearTimeout(suppressAutoScrollTimerRef.current);
      }

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= CHAT_STICKY_BOTTOM_THRESHOLD_PX;
  }, []);

  const handleToggleToolCallExpansion = useCallback(() => {
    suppressAutoScrollTemporarily();
  }, [suppressAutoScrollTemporarily]);

  const handleToggleToolGroupExpansion = useCallback(
    (groupId: string) => {
      if (groupId === streamingToolGroupId) {
        return;
      }

      suppressAutoScrollTemporarily();
      setExpandedToolGroupIds((current) => ({
        ...current,
        [groupId]: !current[groupId],
      }));
    },
    [streamingToolGroupId, suppressAutoScrollTemporarily],
  );

  const handleToggleRowCollapse = useCallback(
    (rowId: string) => {
      if (rowId === streamingTurnRowId) {
        return;
      }

      suppressAutoScrollTemporarily();

      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }));
    },
    [streamingTurnRowId, suppressAutoScrollTemporarily],
  );

  const handleJumpToEarlierMessages = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      pendingHistoryPrependRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      };
    }

    shouldStickToBottomRef.current = false;
    suppressAutoScrollTemporarily();
    onLoadEarlierMessages();
  }, [onLoadEarlierMessages, suppressAutoScrollTemporarily]);

  const handleToggleDiffTree = useCallback(
    (checkpointTurnCount: number) => {
      suppressAutoScrollTemporarily();
      setExpandedDiffTrees((current) => ({
        ...current,
        [checkpointTurnCount]: current[checkpointTurnCount] === false,
      }));
    },
    [suppressAutoScrollTemporarily],
  );

  const renderRow = useCallback(
    (row: TimelineRow) => (
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
      <div ref={containerRef} className={chatScrollableAreaClass} onScroll={handleScroll}>
        <div ref={timelineRootRef} className="relative min-w-0 w-full px-4">
          <div
            className="relative min-w-0 w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) {
                return null;
              }

              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute top-0 left-0 w-full min-w-0"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {renderRow(row)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
