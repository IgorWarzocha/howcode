import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import { ThreadTimelineRow } from "./ThreadTimelineRow";
import { buildTimelineRows } from "./buildTimelineRows";
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX, isScrollContainerNearBottom } from "./chat-scroll";
import { chatScrollableAreaClass, chatViewportClass } from "./thread-layout";
import type { TimelineRow } from "./timeline-row";
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
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const pendingHistoryPrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);

  const rows = useMemo<TimelineRow[]>(
    () => buildTimelineRows({ messages, previousMessageCount, turnDiffSummaries }),
    [messages, previousMessageCount, turnDiffSummaries],
  );
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
      buildVirtualizedThreadTimelineState({
        rows,
        messages,
        isStreaming,
        collapsedRowIds,
        expandedToolGroupIds,
        expandedDiffTrees,
        timelineWidthPx: null,
      }),
    [collapsedRowIds, expandedDiffTrees, expandedToolGroupIds, isStreaming, messages, rows],
  );

  useEffect(() => {
    setCollapsedRowIds((current) => {
      const next = foldableRows.reduce<Record<string, boolean>>((result, row) => {
        if (row.id === streamingTurnRowId) {
          result[row.id] = false;
          return result;
        }

        if (Object.prototype.hasOwnProperty.call(current, row.id)) {
          result[row.id] = current[row.id] as boolean;
          return result;
        }

        result[row.id] = row.id !== latestTurnRowId;
        return result;
      }, {});

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

    const bottomSentinel = bottomSentinelRef.current;
    if (bottomSentinel) {
      bottomSentinel.scrollIntoView({ block: "end" });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useLayoutEffect(() => {
    void bottomAnchorKey;
    void composerLayoutVersion;
    void rowStructureSignature;

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const pendingHistoryPrepend = pendingHistoryPrependRef.current;
    if (pendingHistoryPrepend) {
      const delta = container.scrollHeight - pendingHistoryPrepend.scrollHeight;
      container.scrollTop = pendingHistoryPrepend.scrollTop + Math.max(0, delta);
      pendingHistoryPrependRef.current = null;
      return;
    }

    if (!rows.length) {
      return;
    }

    if (shouldStickToBottomRef.current) {
      scrollToBottom();
    }
  }, [bottomAnchorKey, composerLayoutVersion, rowStructureSignature, rows.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    shouldStickToBottomRef.current = isScrollContainerNearBottom(
      {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
      },
      CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
    );
  }, []);

  const handleToggleRowCollapse = useCallback(
    (rowId: string) => {
      if (rowId === streamingTurnRowId) {
        return;
      }

      shouldStickToBottomRef.current = false;
      setCollapsedRowIds((current) => ({
        ...current,
        [rowId]: !current[rowId],
      }));
    },
    [streamingTurnRowId],
  );

  const handleToggleToolCallExpansion = useCallback(() => {
    shouldStickToBottomRef.current = false;
  }, []);

  const handleToggleToolGroupExpansion = useCallback(
    (groupId: string) => {
      if (groupId === streamingToolGroupId) {
        return;
      }

      shouldStickToBottomRef.current = false;
      setExpandedToolGroupIds((current) => ({
        ...current,
        [groupId]: !current[groupId],
      }));
    },
    [streamingToolGroupId],
  );

  const handleToggleDiffTree = useCallback((checkpointTurnCount: number) => {
    shouldStickToBottomRef.current = false;
    setExpandedDiffTrees((current) => ({
      ...current,
      [checkpointTurnCount]: current[checkpointTurnCount] === false,
    }));
  }, []);

  const handleJumpToEarlierMessages = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      pendingHistoryPrependRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      };
    }

    shouldStickToBottomRef.current = false;
    onLoadEarlierMessages();
  }, [onLoadEarlierMessages]);

  const renderRow = useCallback(
    (row: TimelineRow) => (
      <div key={row.id} className="min-w-0 pb-4" data-timeline-row-id={row.id}>
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
      <div ref={containerRef} className={chatScrollableAreaClass} onScroll={handleScroll}>
        <div className="mx-auto w-full min-w-0 max-w-[744px] overflow-x-hidden px-4 pt-4 pb-8">
          {rows.map(renderRow)}
          <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
        </div>
      </div>
    </div>
  );
}
