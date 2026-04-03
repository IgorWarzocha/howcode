import { useCallback, useEffect, useMemo, useState } from "react";
import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import { ThreadTimelineRow } from "./ThreadTimelineRow";
import { buildTimelineRows } from "./buildTimelineRows";
import {
  CHAT_TOP_PADDING_PX,
  chatScrollableAreaClass,
  chatStreamingTimelineClass,
  chatTimelinePaddingClass,
  chatViewportClass,
} from "./thread-layout";
import {
  getCollapsibleRowKey,
  getFoldableRows,
  getMessageRenderSignature,
  getRowStructureSignature,
  getStreamingAssistantMessageId,
} from "./thread-timeline-signatures";
import type { TimelineRow } from "./timeline-row";
import { useThreadTimelineVirtualizer } from "./useThreadTimelineVirtualizer";

type VirtualizedThreadTimelineProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
};

export function VirtualizedThreadTimeline({
  messages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
  onOpenTurnDiff,
}: VirtualizedThreadTimelineProps) {
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
  const streamingAssistantMessageId = useMemo(
    () => getStreamingAssistantMessageId(messages, isStreaming),
    [isStreaming, messages],
  );
  const rowStructureSignature = useMemo(
    () => getRowStructureSignature(rows, collapsedRowIds),
    [collapsedRowIds, rows],
  );
  const foldableRows = useMemo(() => getFoldableRows(rows), [rows]);
  const lastFoldableRowId = foldableRows[foldableRows.length - 1]?.id ?? null;

  const {
    containerRef,
    timelineRootRef,
    rowVirtualizer,
    virtualRows,
    totalHeightPx,
    handleScroll,
    suppressScrollAdjustTemporarily,
  } = useThreadTimelineVirtualizer({
    rows,
    collapsedRowIds,
    rowStructureSignature,
    bottomAnchorKey,
    isStreaming,
  });

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

  const handleJumpToEarlierMessages = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ top: 0, behavior: "smooth" });
  }, [containerRef]);

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

  if (isStreaming) {
    return (
      <div className={chatViewportClass}>
        <div ref={containerRef} className={chatScrollableAreaClass} onScroll={handleScroll}>
          <div ref={timelineRootRef} className={chatStreamingTimelineClass}>
            {rows.map((row) => (
              <div key={getCollapsibleRowKey(row, collapsedRowIds)} className="min-w-0">
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
          <div className="relative w-full" style={{ height: `${totalHeightPx}px` }}>
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
