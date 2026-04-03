import { measureElement as measureVirtualElement, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import { ThreadTimelineRow } from "./ThreadTimelineRow";
import { buildTimelineRows } from "./buildTimelineRows";
import { estimateThreadTimelineRowHeight } from "./estimateThreadTimelineRowHeight";
import {
  CHAT_BOTTOM_PADDING_PX,
  CHAT_ROW_GAP_PX,
  CHAT_STICKY_BOTTOM_THRESHOLD_PX,
  CHAT_TOP_PADDING_PX,
  chatScrollableAreaClass,
  chatStreamingTimelineClass,
  chatTimelinePaddingClass,
  chatViewportClass,
} from "./thread-layout";
import type { TimelineRow } from "./timeline-row";

type VirtualizedThreadTimelineProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
};

function getMessageRenderSignature(message: Message | undefined) {
  if (!message) {
    return "empty";
  }

  switch (message.role) {
    case "user":
    case "toolResult":
    case "custom":
    case "branchSummary":
    case "compactionSummary":
      return `${message.id}:${message.role}:${message.content.join("\n").length}`;
    case "assistant":
      return `${message.id}:${message.role}:${message.content.join("\n").length}:${message.thinkingContent?.join("\n").length ?? 0}:${message.thinkingHeaders?.join(",").length ?? 0}`;
    case "bashExecution":
      return `${message.id}:${message.role}:${message.command.length}:${message.output.join("\n").length}`;
    default:
      return "unknown";
  }
}

export function VirtualizedThreadTimeline({
  messages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
  onOpenTurnDiff,
}: VirtualizedThreadTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const suppressScrollAdjustRef = useRef(false);
  const suppressScrollAdjustTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [timelineWidthPx, setTimelineWidthPx] = useState<number | null>(null);
  const [expandedDiffTrees, setExpandedDiffTrees] = useState<Record<number, boolean>>({});
  const [collapsedRowIds, setCollapsedRowIds] = useState<Record<string, boolean>>({});

  const rows = useMemo<TimelineRow[]>(
    () => buildTimelineRows({ messages, previousMessageCount, turnDiffSummaries }),
    [messages, previousMessageCount, turnDiffSummaries],
  );

  const bottomAnchorKey = useMemo(
    () =>
      `${getMessageRenderSignature(messages[messages.length - 1])}:${isStreaming ? "streaming" : "idle"}`,
    [isStreaming, messages],
  );

  const streamingAssistantMessageId = useMemo(() => {
    if (!isStreaming) {
      return null;
    }

    const latestAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    return latestAssistantMessage?.id ?? null;
  }, [isStreaming, messages]);

  const rowStructureSignature = useMemo(
    () =>
      rows
        .map((row) => {
          if (row.kind === "history-divider") {
            return `${row.id}:${row.hiddenCount}`;
          }

          if (row.kind === "turn") {
            return `${row.id}:${collapsedRowIds[row.id] ? "collapsed" : "expanded"}:${row.items.length}`;
          }

          if (row.kind === "summary") {
            return `${row.id}:${collapsedRowIds[row.id] ? "collapsed" : "expanded"}`;
          }

          if (row.kind === "tool-group") {
            return `${row.id}:${row.messages.length}`;
          }

          return `${row.id}:${row.turnSummary?.files.length ?? 0}`;
        })
        .join("||"),
    [collapsedRowIds, rows],
  );
  const foldableRows = useMemo(
    () =>
      rows.filter(
        (row): row is Extract<TimelineRow, { kind: "turn" | "summary" }> =>
          row.kind === "turn" || row.kind === "summary",
      ),
    [rows],
  );
  const lastFoldableRowId = foldableRows[foldableRows.length - 1]?.id ?? null;

  useLayoutEffect(() => {
    const timelineRoot = timelineRootRef.current;
    if (!timelineRoot) {
      return;
    }

    const updateWidth = (nextWidth: number) => {
      setTimelineWidthPx((previousWidth) => {
        if (previousWidth !== null && Math.abs(previousWidth - nextWidth) < 0.5) {
          return previousWidth;
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

    return () => observer.disconnect();
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    getItemKey: (index) => {
      const row = rows[index];
      if (!row) {
        return index;
      }

      if (row.kind === "turn" || row.kind === "summary") {
        return `${row.id}:${collapsedRowIds[row.id] ? "collapsed" : "expanded"}`;
      }

      return row.id;
    },
    estimateSize: (index) => {
      const row = rows[index] ?? { kind: "history-divider", id: "missing", hiddenCount: 0 };
      return estimateThreadTimelineRowHeight(row, {
        collapsed:
          row.kind === "turn" || row.kind === "summary" ? Boolean(collapsedRowIds[row.id]) : false,
      });
    },
    measureElement: measureVirtualElement,
    useAnimationFrameWithResizeObserver: true,
    overscan: 8,
    gap: CHAT_ROW_GAP_PX,
  });

  useEffect(() => {
    if (timelineWidthPx === null) {
      return;
    }

    rowVirtualizer.measure();
  }, [rowVirtualizer, timelineWidthPx]);

  useLayoutEffect(() => {
    void rowStructureSignature;
    rowVirtualizer.measure();
  }, [rowStructureSignature, rowVirtualizer]);

  useEffect(() => {
    setCollapsedRowIds((current) => {
      const next: Record<string, boolean> = {};

      for (const row of foldableRows) {
        if (row.id === lastFoldableRowId) {
          next[row.id] = false;
          continue;
        }

        next[row.id] = current[row.id] ?? true;
      }

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
  }, [foldableRows, lastFoldableRowId]);

  useEffect(() => {
    rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = (_item, _delta, instance) => {
      if (suppressScrollAdjustRef.current) {
        return false;
      }

      if (shouldStickToBottomRef.current) {
        return true;
      }

      const viewportHeight = instance.scrollRect?.height ?? 0;
      const scrollOffset = instance.scrollOffset ?? 0;
      const remainingDistance = instance.getTotalSize() - (scrollOffset + viewportHeight);
      return remainingDistance > CHAT_STICKY_BOTTOM_THRESHOLD_PX;
    };

    return () => {
      rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    };
  }, [rowVirtualizer]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (isStreaming) {
      container.scrollTo({ top: container.scrollHeight });
      return;
    }

    rowVirtualizer.scrollToOffset(rowVirtualizer.getTotalSize(), { align: "end" });

    window.requestAnimationFrame(() => {
      const nextContainer = containerRef.current;
      if (!nextContainer) {
        return;
      }

      nextContainer.scrollTo({ top: nextContainer.scrollHeight });
    });
  }, [isStreaming, rowVirtualizer]);

  useLayoutEffect(() => {
    void bottomAnchorKey;
    void rowStructureSignature;

    if (!rows.length || !shouldStickToBottomRef.current) {
      return;
    }

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollToBottom();
      scrollFrameRef.current = null;
    });
  }, [bottomAnchorKey, rowStructureSignature, rows.length, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (suppressScrollAdjustTimerRef.current !== null) {
        window.clearTimeout(suppressScrollAdjustTimerRef.current);
      }

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const suppressScrollAdjustTemporarily = useCallback(() => {
    suppressScrollAdjustRef.current = true;
    if (suppressScrollAdjustTimerRef.current !== null) {
      window.clearTimeout(suppressScrollAdjustTimerRef.current);
    }

    suppressScrollAdjustTimerRef.current = window.setTimeout(() => {
      suppressScrollAdjustRef.current = false;
      suppressScrollAdjustTimerRef.current = null;
    }, 180);
  }, []);

  const handleToggleToolCallExpansion = useCallback(() => {
    suppressScrollAdjustTemporarily();
  }, [suppressScrollAdjustTemporarily]);

  const handleToggleRowCollapse = useCallback(
    (rowId: string) => {
      suppressScrollAdjustTemporarily();
      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }));

      window.requestAnimationFrame(() => {
        rowVirtualizer.measure();
      });
    },
    [rowVirtualizer, suppressScrollAdjustTemporarily],
  );

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= CHAT_STICKY_BOTTOM_THRESHOLD_PX;
  }, []);

  const handleJumpToEarlierMessages = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleToggleDiffTree = useCallback((checkpointTurnCount: number) => {
    setExpandedDiffTrees((current) => ({
      ...current,
      [checkpointTurnCount]: current[checkpointTurnCount] === false,
    }));
  }, []);

  const renderRow = useCallback(
    (row: TimelineRow) => (
      <ThreadTimelineRow
        row={row}
        collapsed={Boolean(collapsedRowIds[row.id])}
        streamingAssistantMessageId={streamingAssistantMessageId}
        expandedDiffTrees={expandedDiffTrees}
        onToggleRowCollapse={handleToggleRowCollapse}
        onToggleToolCallExpansion={handleToggleToolCallExpansion}
        onToggleDiffTree={handleToggleDiffTree}
        onOpenTurnDiff={onOpenTurnDiff}
        onJumpToEarlierMessages={handleJumpToEarlierMessages}
      />
    ),
    [
      collapsedRowIds,
      expandedDiffTrees,
      handleJumpToEarlierMessages,
      handleToggleDiffTree,
      handleToggleRowCollapse,
      handleToggleToolCallExpansion,
      onOpenTurnDiff,
      streamingAssistantMessageId,
    ],
  );

  const virtualRows = rowVirtualizer.getVirtualItems();

  if (isStreaming) {
    return (
      <div className={chatViewportClass}>
        <div ref={containerRef} className={chatScrollableAreaClass} onScroll={handleScroll}>
          <div ref={timelineRootRef} className={chatStreamingTimelineClass}>
            {rows.map((row) => (
              <div
                key={
                  row.kind === "turn" || row.kind === "summary"
                    ? `${row.id}:${collapsedRowIds[row.id] ? "collapsed" : "expanded"}`
                    : row.id
                }
                className="min-w-0"
              >
                {renderRow(row)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={chatViewportClass}>
      <div ref={containerRef} className={chatScrollableAreaClass} onScroll={handleScroll}>
        <div
          ref={timelineRootRef}
          className={`relative w-full ${chatTimelinePaddingClass} [&>*]:min-w-0`}
        >
          <div
            className="relative w-full"
            style={{
              height: `${rowVirtualizer.getTotalSize() + CHAT_TOP_PADDING_PX + CHAT_BOTTOM_PADDING_PX}px`,
            }}
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
                  className="absolute top-0 left-0 w-full min-w-0"
                  data-index={virtualRow.index}
                  style={{
                    transform: `translateY(${virtualRow.start + CHAT_TOP_PADDING_PX}px)`,
                  }}
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
