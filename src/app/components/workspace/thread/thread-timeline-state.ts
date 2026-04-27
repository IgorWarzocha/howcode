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
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.kind === "turn") {
      return row.id;
    }
  }

  return null;
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

export function buildThreadTimelineState({
  rows,
  messages,
  isStreaming,
  collapsedRowIds,
  expandedToolGroupIds,
}: {
  rows: TimelineRow[];
  messages: Message[];
  isStreaming: boolean;
  collapsedRowIds: Record<string, boolean>;
  expandedToolGroupIds: Record<string, boolean>;
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

  return {
    bottomAnchorKey,
    effectiveCollapsedRowIds,
    expandedToolGroupSignature,
    firstUnvirtualizedRowIndex: 0,
    foldableRows,
    latestTurnRowId,
    rowStructureSignature,
    streamingAssistantMessageId,
    streamingToolGroupId,
    streamingTurnRowId,
    virtualMeasureSignature: [expandedToolGroupSignature, rowStructureSignature, 0].join("@@"),
    virtualizedRowCount: 0,
  };
}
