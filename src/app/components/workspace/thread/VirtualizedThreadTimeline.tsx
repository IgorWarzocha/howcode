import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import { ThreadTimelineRow } from "./ThreadTimelineRow";
import { buildTimelineRows } from "./buildTimelineRows";
import { reconcileCollapsedRowIds } from "./reconcileCollapsedRowIds";
import {
  CHAT_STICKY_BOTTOM_THRESHOLD_PX,
  chatScrollableAreaClass,
  chatStreamingTimelineClass,
  chatViewportClass,
} from "./thread-layout";
import {
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
  const timelineRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const pendingHistoryPrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const suppressAutoScrollRef = useRef(false);
  const suppressAutoScrollTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);

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
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, []);

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
  }, [bottomAnchorKey, rowStructureSignature, rows.length, scheduleScrollToBottom]);

  useEffect(() => {
    const container = containerRef.current;
    const timeline = timelineRef.current;
    if (!container || !timeline || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      // Streaming updates can change layout after the initial render pass
      // (for example when markdown, thinking panels, or tool groups reflow).
      // Re-assert the sticky-bottom position whenever the lane or viewport resizes.
      scheduleScrollToBottom();
    });

    resizeObserver.observe(container);
    resizeObserver.observe(timeline);

    return () => {
      resizeObserver.disconnect();
    };
  }, [scheduleScrollToBottom]);

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
        {/*
          The thread lane renders in natural document flow on purpose.
          Rich markdown, reasoning panels, tool-call accordions, and inline diffs were too dynamic
          for heuristic row-height prediction to stay reliable under virtualization.
        */}
        <div ref={timelineRef} className={chatStreamingTimelineClass}>
          {rows.map((row) => (
            <div key={row.id} className="min-w-0">
              {renderRow(row)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
