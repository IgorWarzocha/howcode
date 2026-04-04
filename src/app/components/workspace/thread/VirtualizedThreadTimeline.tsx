import { measureElement as measureVirtualElement, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import { ThreadTimelineRow } from "./ThreadTimelineRow";
import { buildTimelineRows } from "./buildTimelineRows";
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX, isScrollContainerNearBottom } from "./chat-scroll";
import { estimateThreadTimelineRowHeight } from "./estimateThreadTimelineRowHeight";
import { reconcileCollapsedRowIds } from "./reconcileCollapsedRowIds";
import { chatScrollableAreaClass, chatViewportClass } from "./thread-layout";
import {
  getCollapsibleRowKey,
  getFoldableRows,
  getMessageRenderSignature,
  getRowStructureSignature,
  getStreamingAssistantMessageId,
  getStreamingToolGroupId,
} from "./thread-timeline-signatures";
import type { TimelineRow } from "./timeline-row";

const ALWAYS_UNVIRTUALIZED_TAIL_ROWS = 8;

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
  const [timelineWidthPx, setTimelineWidthPx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const lastKnownScrollTopRef = useRef(0);
  const isPointerScrollActiveRef = useRef(false);
  const lastTouchClientYRef = useRef<number | null>(null);
  const pendingUserScrollUpIntentRef = useRef(false);
  const pendingInteractionAnchorRef = useRef<{ element: HTMLElement; top: number } | null>(null);
  const pendingExpandedRowRevealRef = useRef<string | null>(null);
  const pendingExpandedRowRevealFrameRef = useRef<number | null>(null);
  const pendingHistoryPrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const suppressAutoScrollRef = useRef(false);
  const suppressAutoScrollTimerRef = useRef<number | null>(null);
  const pendingAutoScrollFrameRef = useRef<number | null>(null);
  const pendingInteractionAnchorFrameRef = useRef<number | null>(null);
  const pendingMeasureFrameRef = useRef<number | null>(null);

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
  const expandedToolGroupSignature = useMemo(
    () =>
      Object.keys(expandedToolGroupIds)
        .sort()
        .map((key) => `${key}:${expandedToolGroupIds[key] ? "1" : "0"}`)
        .join("||"),
    [expandedToolGroupIds],
  );
  const expandedDiffTreeSignature = useMemo(
    () =>
      Object.keys(expandedDiffTrees)
        .sort((left, right) => Number(left) - Number(right))
        .map((key) => `${key}:${expandedDiffTrees[Number(key)] ? "1" : "0"}`)
        .join("||"),
    [expandedDiffTrees],
  );
  const firstUnvirtualizedRowIndex = useMemo(() => {
    const firstTailRowIndex = Math.max(rows.length - ALWAYS_UNVIRTUALIZED_TAIL_ROWS, 0);
    if (!isStreaming || !streamingTurnRowId) {
      return firstTailRowIndex;
    }

    const streamingTurnIndex = rows.findIndex((row) => row.id === streamingTurnRowId);
    if (streamingTurnIndex < 0) {
      return firstTailRowIndex;
    }

    return Math.min(streamingTurnIndex, firstTailRowIndex);
  }, [isStreaming, rows, streamingTurnRowId]);
  const virtualizedRowCount = Math.max(0, Math.min(firstUnvirtualizedRowIndex, rows.length));
  const virtualMeasureSignature = useMemo(
    () =>
      [
        expandedDiffTreeSignature,
        expandedToolGroupSignature,
        rowStructureSignature,
        timelineWidthPx ?? "auto",
        virtualizedRowCount,
      ].join("@@"),
    [
      expandedDiffTreeSignature,
      expandedToolGroupSignature,
      rowStructureSignature,
      timelineWidthPx,
      virtualizedRowCount,
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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior });
    lastKnownScrollTopRef.current = container.scrollTop;
    shouldStickToBottomRef.current = true;
  }, []);

  const cancelPendingScrollToBottom = useCallback(() => {
    if (pendingAutoScrollFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(pendingAutoScrollFrameRef.current);
    pendingAutoScrollFrameRef.current = null;
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    if (!shouldStickToBottomRef.current || suppressAutoScrollRef.current) {
      return;
    }

    if (pendingAutoScrollFrameRef.current !== null) {
      return;
    }

    pendingAutoScrollFrameRef.current = window.requestAnimationFrame(() => {
      pendingAutoScrollFrameRef.current = null;
      scrollToBottom();
    });
  }, [scrollToBottom]);

  const cancelPendingInteractionAnchorAdjustment = useCallback(() => {
    if (pendingInteractionAnchorFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(pendingInteractionAnchorFrameRef.current);
    pendingInteractionAnchorFrameRef.current = null;
  }, []);

  const suppressAutoScrollTemporarily = useCallback(() => {
    if (shouldStickToBottomRef.current) {
      return;
    }

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
    const timelineRoot = timelineRootRef.current;
    if (!timelineRoot) {
      return;
    }

    const updateWidth = (nextWidth: number) => {
      setTimelineWidthPx((current) => {
        if (current !== null && Math.abs(current - nextWidth) < 0.5) {
          return current;
        }

        return nextWidth;
      });
    };

    updateWidth(timelineRoot.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth(timelineRoot.getBoundingClientRect().width);
    });
    observer.observe(timelineRoot);

    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    void bottomAnchorKey;
    void rowStructureSignature;

    const container = containerRef.current;
    const pendingHistoryPrepend = pendingHistoryPrependRef.current;

    if (container && pendingHistoryPrepend) {
      const delta = container.scrollHeight - pendingHistoryPrepend.scrollHeight;
      container.scrollTop = pendingHistoryPrepend.scrollTop + Math.max(0, delta);
      pendingHistoryPrependRef.current = null;
      lastKnownScrollTopRef.current = container.scrollTop;
      return;
    }

    if (!rows.length) {
      return;
    }

    scheduleScrollToBottom();
  }, [bottomAnchorKey, rowStructureSignature, rows.length, scheduleScrollToBottom]);

  useLayoutEffect(() => {
    void virtualMeasureSignature;
    rowVirtualizer.measure();
  }, [rowVirtualizer, virtualMeasureSignature]);

  useLayoutEffect(() => {
    void rowStructureSignature;

    const rowId = pendingExpandedRowRevealRef.current;
    if (!rowId) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (pendingExpandedRowRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingExpandedRowRevealFrameRef.current);
    }

    pendingExpandedRowRevealFrameRef.current = window.requestAnimationFrame(() => {
      pendingExpandedRowRevealFrameRef.current = null;

      const activeContainer = containerRef.current;
      if (!activeContainer) {
        return;
      }

      const rowElement = Array.from(
        activeContainer.querySelectorAll<HTMLElement>("[data-timeline-row-id]"),
      ).find((element) => element.dataset.timelineRowId === rowId);
      if (!rowElement) {
        return;
      }

      const anchorElement =
        rowElement.querySelector<HTMLElement>("[data-row-toggle-anchor='true']") ?? rowElement;
      const containerRect = activeContainer.getBoundingClientRect();
      const anchorRect = anchorElement.getBoundingClientRect();
      const desiredTop = containerRect.top + 12;
      const delta = anchorRect.top - desiredTop;

      if (Math.abs(delta) >= 0.5) {
        activeContainer.scrollTop += delta;
      }

      lastKnownScrollTopRef.current = activeContainer.scrollTop;
      shouldStickToBottomRef.current = false;
      pendingExpandedRowRevealRef.current = null;
    });

    return () => {
      if (pendingExpandedRowRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingExpandedRowRevealFrameRef.current);
        pendingExpandedRowRevealFrameRef.current = null;
      }
    };
  }, [rowStructureSignature]);

  useEffect(() => {
    rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = (_item, _delta, instance) => {
      const viewportHeight = instance.scrollRect?.height ?? 0;
      const scrollOffset = instance.scrollOffset ?? 0;
      const remainingDistance = instance.getTotalSize() - (scrollOffset + viewportHeight);

      return remainingDistance > CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
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

    const observer = new ResizeObserver(() => {
      if (pendingMeasureFrameRef.current !== null) {
        return;
      }

      pendingMeasureFrameRef.current = window.requestAnimationFrame(() => {
        pendingMeasureFrameRef.current = null;
        rowVirtualizer.measure();
        scheduleScrollToBottom();
      });
    });

    observer.observe(container);
    observer.observe(timelineRoot);

    return () => {
      observer.disconnect();
      if (pendingMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingMeasureFrameRef.current);
        pendingMeasureFrameRef.current = null;
      }
    };
  }, [rowVirtualizer, scheduleScrollToBottom]);

  useEffect(() => {
    return () => {
      cancelPendingInteractionAnchorAdjustment();
      cancelPendingScrollToBottom();

      if (suppressAutoScrollTimerRef.current !== null) {
        window.clearTimeout(suppressAutoScrollTimerRef.current);
      }

      if (pendingMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingMeasureFrameRef.current);
        pendingMeasureFrameRef.current = null;
      }

      if (pendingExpandedRowRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingExpandedRowRevealFrameRef.current);
        pendingExpandedRowRevealFrameRef.current = null;
      }
    };
  }, [cancelPendingInteractionAnchorAdjustment, cancelPendingScrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const currentScrollTop = container.scrollTop;
    const isNearBottom = isScrollContainerNearBottom(
      container,
      CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
    );

    if (!shouldStickToBottomRef.current && isNearBottom) {
      shouldStickToBottomRef.current = true;
      pendingUserScrollUpIntentRef.current = false;
    } else if (shouldStickToBottomRef.current && pendingUserScrollUpIntentRef.current) {
      if (currentScrollTop < lastKnownScrollTopRef.current - 1) {
        shouldStickToBottomRef.current = false;
      }
      pendingUserScrollUpIntentRef.current = false;
    } else if (shouldStickToBottomRef.current && isPointerScrollActiveRef.current) {
      if (currentScrollTop < lastKnownScrollTopRef.current - 1) {
        shouldStickToBottomRef.current = false;
      }
    } else if (shouldStickToBottomRef.current && !isNearBottom) {
      if (currentScrollTop < lastKnownScrollTopRef.current - 1) {
        shouldStickToBottomRef.current = false;
      }
    }

    lastKnownScrollTopRef.current = currentScrollTop;
  }, []);

  const handleScrollClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || !(event.target instanceof Element)) {
        return;
      }

      const trigger = event.target.closest<HTMLElement>(
        "button, summary, [role='button'], [data-scroll-anchor-target]",
      );
      if (!trigger || !container.contains(trigger)) {
        return;
      }

      if (trigger.closest("[data-scroll-anchor-ignore]")) {
        return;
      }

      pendingInteractionAnchorRef.current = {
        element: trigger,
        top: trigger.getBoundingClientRect().top,
      };

      cancelPendingInteractionAnchorAdjustment();
      pendingInteractionAnchorFrameRef.current = window.requestAnimationFrame(() => {
        pendingInteractionAnchorFrameRef.current = null;

        const anchor = pendingInteractionAnchorRef.current;
        pendingInteractionAnchorRef.current = null;
        const activeContainer = containerRef.current;
        if (!anchor || !activeContainer) {
          return;
        }

        if (!anchor.element.isConnected || !activeContainer.contains(anchor.element)) {
          return;
        }

        const nextTop = anchor.element.getBoundingClientRect().top;
        const delta = nextTop - anchor.top;
        if (Math.abs(delta) < 0.5) {
          return;
        }

        activeContainer.scrollTop += delta;
        lastKnownScrollTopRef.current = activeContainer.scrollTop;
      });
    },
    [cancelPendingInteractionAnchorAdjustment],
  );

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      pendingUserScrollUpIntentRef.current = true;
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    isPointerScrollActiveRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    isPointerScrollActiveRef.current = false;
  }, []);

  const handlePointerCancel = useCallback(() => {
    isPointerScrollActiveRef.current = false;
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    lastTouchClientYRef.current = touch.clientY;
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    const previousTouchY = lastTouchClientYRef.current;
    if (previousTouchY !== null && touch.clientY > previousTouchY + 1) {
      pendingUserScrollUpIntentRef.current = true;
    }

    lastTouchClientYRef.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouchClientYRef.current = null;
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

      const isExpanding = Boolean(effectiveCollapsedRowIds[rowId]);
      suppressAutoScrollTemporarily();

      if (isExpanding) {
        shouldStickToBottomRef.current = false;
        pendingExpandedRowRevealRef.current = rowId;
        pendingInteractionAnchorRef.current = null;
        cancelPendingScrollToBottom();
        cancelPendingInteractionAnchorAdjustment();
      }

      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }));
    },
    [
      cancelPendingScrollToBottom,
      cancelPendingInteractionAnchorAdjustment,
      effectiveCollapsedRowIds,
      streamingTurnRowId,
      suppressAutoScrollTemporarily,
    ],
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
          {virtualizedRowCount > 0 ? (
            <div
              className="relative min-w-0"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) {
                  return null;
                }

                return (
                  <div
                    key={`virtual-row:${virtualRow.key}`}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full min-w-0"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {renderRow(row)}
                  </div>
                );
              })}
            </div>
          ) : null}

          {nonVirtualizedRows.map((row) => (
            <div key={`tail-row:${row.id}`} className="min-w-0">
              {renderRow(row)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
