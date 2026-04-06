import type { Message } from "../../../types";
import { reconcileCollapsedRowIds } from "./reconcileCollapsedRowIds";
import {
  getFoldableRows,
  getMessageRenderSignature,
  getRowStructureSignature,
  getStreamingAssistantMessageId,
  getStreamingToolGroupId,
} from "./thread-timeline-signatures";
import type { TimelineRow } from "./timeline-row";

function getExpandedStateSignature(
  expandedState: Record<string, boolean>,
  sortKeys?: (a: string, b: string) => number,
) {
  return Object.keys(expandedState)
    .sort(sortKeys)
    .map((key) => `${key}:${expandedState[key] ? "1" : "0"}`)
    .join("||");
}

function getLatestTurnRowId(rows: TimelineRow[]) {
  return [...rows].reverse().find((row) => row.kind === "turn")?.id ?? null;
}

function getStreamingTurnRowId({
  rows,
  isStreaming,
  streamingAssistantMessageId,
  latestTurnRowId,
}: {
  rows: TimelineRow[];
  isStreaming: boolean;
  streamingAssistantMessageId: string | null;
  latestTurnRowId: string | null;
}) {
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
}

export function buildVirtualizedThreadTimelineState({
  rows,
  messages,
  isStreaming,
  collapsedRowIds,
  expandedToolGroupIds,
  expandedDiffTrees,
  timelineWidthPx,
}: {
  rows: TimelineRow[];
  messages: Message[];
  isStreaming: boolean;
  collapsedRowIds: Record<string, boolean>;
  expandedToolGroupIds: Record<string, boolean>;
  expandedDiffTrees: Record<number, boolean>;
  timelineWidthPx: number | null;
}) {
  const bottomAnchorKey = `${getMessageRenderSignature(messages[messages.length - 1])}:${isStreaming ? "streaming" : "idle"}`;
  const streamingAssistantMessageId = getStreamingAssistantMessageId(messages, isStreaming);
  const streamingToolGroupId = getStreamingToolGroupId(rows, messages, isStreaming);
  const foldableRows = getFoldableRows(rows);
  const latestTurnRowId = getLatestTurnRowId(rows);
  const streamingTurnRowId = getStreamingTurnRowId({
    rows,
    isStreaming,
    streamingAssistantMessageId,
    latestTurnRowId,
  });
  const effectiveCollapsedRowIds = reconcileCollapsedRowIds(foldableRows, collapsedRowIds, {
    defaultExpandedRowId: latestTurnRowId,
    forcedExpandedRowId: streamingTurnRowId,
  });
  const rowStructureSignature = getRowStructureSignature(rows, effectiveCollapsedRowIds);
  const expandedToolGroupSignature = getExpandedStateSignature(expandedToolGroupIds);
  const expandedDiffTreeSignature = getExpandedStateSignature(
    Object.fromEntries(
      Object.entries(expandedDiffTrees).map(([key, value]) => [String(key), value]),
    ),
    (left, right) => Number(left) - Number(right),
  );
  // Top-level thread rows have too many layout modes (collapsed previews, expanded summaries,
  // streaming content, inline diffs, tool groups) for estimate-based virtualization to stay stable.
  // Keep them in normal document flow until we have a measured-only strategy.
  const firstUnvirtualizedRowIndex = 0;
  const virtualizedRowCount = 0;
  const virtualMeasureSignature = [
    expandedDiffTreeSignature,
    expandedToolGroupSignature,
    rowStructureSignature,
    timelineWidthPx ?? "auto",
    virtualizedRowCount,
  ].join("@@");

  return {
    bottomAnchorKey,
    effectiveCollapsedRowIds,
    expandedDiffTreeSignature,
    expandedToolGroupSignature,
    firstUnvirtualizedRowIndex,
    foldableRows,
    latestTurnRowId,
    rowStructureSignature,
    streamingAssistantMessageId,
    streamingToolGroupId,
    streamingTurnRowId,
    virtualMeasureSignature,
    virtualizedRowCount,
  };
}
