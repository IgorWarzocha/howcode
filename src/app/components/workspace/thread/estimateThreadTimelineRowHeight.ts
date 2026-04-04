import { CHAT_COLLAPSED_ROW_HEIGHT_PX, CHAT_HISTORY_DIVIDER_HEIGHT_PX } from "./thread-layout";
import type { TimelineRow, TimelineTurnItem, ToolCallMessage } from "./timeline-row";

type TimelineMessageRow = Extract<TimelineTurnItem, { kind: "message" }>;

type EstimateThreadTimelineRowHeightInput = {
  row: TimelineRow;
  collapsed: boolean;
  expandedToolGroupIds: Record<string, boolean>;
  expandedDiffTrees: Record<number, boolean>;
  streamingAssistantMessageId: string | null;
  streamingToolGroupId: string | null;
};

function estimateTextHeight(characters: number, charsPerLine: number, lineHeight: number) {
  const estimatedLines = Math.max(1, Math.ceil(characters / charsPerLine));
  return estimatedLines * lineHeight;
}

function estimateToolCallHeight(message: ToolCallMessage, expanded: boolean) {
  const previewHeight = 36;
  if (!expanded) {
    return previewHeight;
  }

  if (message.role === "toolResult") {
    return previewHeight + 24 + estimateTextHeight(message.content.join(" ").length, 72, 18);
  }

  return (
    previewHeight +
    52 +
    estimateTextHeight([message.command, ...message.output].join(" ").length, 76, 16)
  );
}

function estimateMessageHeight(message: TimelineMessageRow) {
  switch (message.message.role) {
    case "assistant": {
      const thinkingCharacters = [
        ...(message.message.thinkingHeaders ?? []),
        ...(message.message.thinkingContent ?? []),
      ].join(" ").length;
      const proseCharacters = message.message.content.join(" ").length;

      return (
        24 +
        estimateTextHeight(proseCharacters, 72, 24) +
        (thinkingCharacters > 0 ? 52 + estimateTextHeight(thinkingCharacters, 76, 18) : 0)
      );
    }
    case "custom":
      return 76 + estimateTextHeight(message.message.content.join(" ").length, 72, 18);
    case "branchSummary":
    case "compactionSummary":
      return 84 + estimateTextHeight(message.message.content.join(" ").length, 72, 18);
    case "user":
      return 44 + estimateTextHeight(message.message.content.join(" ").length, 58, 22);
    case "toolResult":
      return 72 + estimateTextHeight(message.message.content.join(" ").length, 72, 18);
    case "bashExecution":
      return (
        84 +
        estimateTextHeight(
          [message.message.command, ...message.message.output].join(" ").length,
          76,
          16,
        )
      );
    default:
      return 96;
  }
}

function estimateDiffHeight(turnSummary: TimelineMessageRow["turnSummary"], expanded: boolean) {
  if (!turnSummary || turnSummary.files.length === 0) {
    return 0;
  }

  const visibleFileRows = Math.min(turnSummary.files.length, expanded ? 10 : 4);
  return 92 + visibleFileRows * 20;
}

function estimateTurnItemHeight(
  item: TimelineTurnItem,
  expandedToolGroupIds: Record<string, boolean>,
  expandedDiffTrees: Record<number, boolean>,
  streamingToolGroupId: string | null,
) {
  if (item.kind === "tool-group") {
    const groupExpanded =
      item.id === streamingToolGroupId || Boolean(expandedToolGroupIds[item.id]);
    if (!groupExpanded) {
      return 48;
    }

    return (
      48 +
      item.messages.reduce(
        (total, message) => total + estimateToolCallHeight(message, false) + 4,
        0,
      )
    );
  }

  return (
    estimateMessageHeight(item) +
    estimateDiffHeight(
      item.turnSummary,
      expandedDiffTrees[item.turnSummary?.checkpointTurnCount ?? -1] !== false,
    )
  );
}

export function estimateThreadTimelineRowHeight({
  row,
  collapsed,
  expandedToolGroupIds,
  expandedDiffTrees,
  streamingAssistantMessageId,
  streamingToolGroupId,
}: EstimateThreadTimelineRowHeightInput) {
  if (row.kind === "history-divider") {
    return CHAT_HISTORY_DIVIDER_HEIGHT_PX;
  }

  if (row.kind === "summary") {
    return collapsed
      ? CHAT_COLLAPSED_ROW_HEIGHT_PX
      : 92 + estimateTextHeight(row.message.content.join(" ").length, 72, 18);
  }

  if (row.kind === "tool-group") {
    return estimateTurnItemHeight(
      row,
      expandedToolGroupIds,
      expandedDiffTrees,
      streamingToolGroupId,
    );
  }

  if (row.kind === "message") {
    const baseHeight =
      estimateMessageHeight(row) +
      estimateDiffHeight(
        row.turnSummary,
        expandedDiffTrees[row.turnSummary?.checkpointTurnCount ?? -1] !== false,
      );

    return row.message.id === streamingAssistantMessageId ? baseHeight + 36 : baseHeight;
  }

  if (collapsed) {
    return CHAT_COLLAPSED_ROW_HEIGHT_PX;
  }

  const leadHeight = row.userMessage
    ? 12 +
      estimateTextHeight(
        row.userMessage.content.join(" ").length,
        row.userMessage.role === "user" ? 58 : 72,
        row.userMessage.role === "user" ? 22 : 24,
      )
    : 0;
  const itemsHeight = row.items.reduce(
    (total, item) =>
      total +
      estimateTurnItemHeight(item, expandedToolGroupIds, expandedDiffTrees, streamingToolGroupId),
    0,
  );
  const rowGap =
    Math.max(0, row.items.length - 1) * 12 + (row.userMessage && row.items.length > 0 ? 12 : 0);
  const includesStreamingAssistant = row.items.some(
    (item) => item.kind === "message" && item.message.id === streamingAssistantMessageId,
  );

  return Math.max(
    CHAT_COLLAPSED_ROW_HEIGHT_PX,
    24 + leadHeight + itemsHeight + rowGap + (includesStreamingAssistant ? 16 : 0),
  );
}
