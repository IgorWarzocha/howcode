import type { TimelineRow, TimelineTurnItem, ToolCallMessage } from "./timeline-row";

type EstimateThreadTimelineRowHeightInput = {
  row: TimelineRow;
  collapsed: boolean;
  expandedToolGroupIds: Record<string, boolean>;
  expandedDiffTrees: Record<number, boolean>;
  streamingAssistantMessageId: string | null;
  streamingToolGroupId: string | null;
  timelineWidthPx: number | null;
};

function estimateTextHeight(characters: number, charsPerLine: number, lineHeight: number) {
  const estimatedLines = Math.max(1, Math.ceil(characters / Math.max(16, charsPerLine)));
  return estimatedLines * lineHeight;
}

function getCharsPerLine(timelineWidthPx: number | null, fallback: number) {
  if (timelineWidthPx === null || !Number.isFinite(timelineWidthPx)) {
    return fallback;
  }

  return Math.max(28, Math.floor((timelineWidthPx - 72) / 8));
}

function estimateToolCallHeight(
  message: ToolCallMessage,
  expanded: boolean,
  timelineWidthPx: number | null,
) {
  const previewHeight = 38;
  if (!expanded) {
    return previewHeight;
  }

  const charsPerLine = getCharsPerLine(timelineWidthPx, 72);
  if (message.role === "toolResult") {
    return (
      previewHeight + 28 + estimateTextHeight(message.content.join(" ").length, charsPerLine, 18)
    );
  }

  return (
    previewHeight +
    56 +
    estimateTextHeight([message.command, ...message.output].join(" ").length, charsPerLine, 16)
  );
}

function estimateDiffHeight(fileCount: number, expanded: boolean) {
  if (fileCount <= 0) {
    return 0;
  }

  return 92 + Math.min(fileCount, expanded ? 10 : 4) * 20;
}

function estimateMessageHeight(
  item: Extract<TimelineTurnItem, { kind: "message" }>,
  timelineWidthPx: number | null,
) {
  const charsPerLine = getCharsPerLine(
    timelineWidthPx,
    item.message.role === "user" ? 58 : item.message.role === "assistant" ? 72 : 68,
  );

  switch (item.message.role) {
    case "user":
      return 44 + estimateTextHeight(item.message.content.join(" ").length, charsPerLine, 22);
    case "assistant": {
      const proseHeight = estimateTextHeight(
        item.message.content.join(" ").length,
        charsPerLine,
        24,
      );
      const thinkingChars = [
        ...(item.message.thinkingHeaders ?? []),
        ...(item.message.thinkingContent ?? []),
      ].join(" ").length;
      const thinkingHeight =
        thinkingChars > 0 ? 56 + estimateTextHeight(thinkingChars, charsPerLine, 18) : 0;
      const diffHeight = estimateDiffHeight(
        item.turnSummary?.files.length ?? 0,
        Boolean(item.turnSummary),
      );

      return 28 + proseHeight + thinkingHeight + diffHeight;
    }
    case "custom":
    case "branchSummary":
    case "compactionSummary":
    case "toolResult":
      return 76 + estimateTextHeight(item.message.content.join(" ").length, charsPerLine, 18);
    case "bashExecution":
      return (
        84 +
        estimateTextHeight(
          [item.message.command, ...item.message.output].join(" ").length,
          charsPerLine,
          16,
        )
      );
    default:
      return 96;
  }
}

function estimateTurnItemHeight(
  item: TimelineTurnItem,
  expandedToolGroupIds: Record<string, boolean>,
  expandedDiffTrees: Record<number, boolean>,
  streamingToolGroupId: string | null,
  timelineWidthPx: number | null,
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
        (total, message) => total + estimateToolCallHeight(message, false, timelineWidthPx) + 4,
        0,
      )
    );
  }

  return (
    estimateMessageHeight(item, timelineWidthPx) +
    estimateDiffHeight(
      item.turnSummary?.files.length ?? 0,
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
  timelineWidthPx,
}: EstimateThreadTimelineRowHeightInput) {
  if (row.kind === "history-divider") {
    return 44;
  }

  if (row.kind === "summary") {
    return collapsed
      ? 56
      : 92 +
          estimateTextHeight(
            row.message.content.join(" ").length,
            getCharsPerLine(timelineWidthPx, 72),
            18,
          );
  }

  if (row.kind === "tool-group") {
    return estimateTurnItemHeight(
      row,
      expandedToolGroupIds,
      expandedDiffTrees,
      streamingToolGroupId,
      timelineWidthPx,
    );
  }

  if (row.kind === "message") {
    const baseHeight = estimateTurnItemHeight(
      row,
      expandedToolGroupIds,
      expandedDiffTrees,
      streamingToolGroupId,
      timelineWidthPx,
    );
    return row.message.id === streamingAssistantMessageId ? baseHeight + 36 : baseHeight;
  }

  if (collapsed) {
    return 56;
  }

  const leadHeight = row.userMessage
    ? row.userMessage.role === "user"
      ? 44 +
        estimateTextHeight(
          row.userMessage.content.join(" ").length,
          getCharsPerLine(timelineWidthPx, 58),
          22,
        )
      : 28 +
        estimateTextHeight(
          row.userMessage.content.join(" ").length,
          getCharsPerLine(timelineWidthPx, 72),
          24,
        )
    : 0;
  const itemsHeight = row.items.reduce(
    (total, item) =>
      total +
      estimateTurnItemHeight(
        item,
        expandedToolGroupIds,
        expandedDiffTrees,
        streamingToolGroupId,
        timelineWidthPx,
      ),
    0,
  );
  const rowGap =
    Math.max(0, row.items.length - 1) * 12 + (row.userMessage && row.items.length > 0 ? 12 : 0);
  const includesStreamingAssistant = row.items.some(
    (item) => item.kind === "message" && item.message.id === streamingAssistantMessageId,
  );

  return Math.max(96, leadHeight + itemsHeight + rowGap + (includesStreamingAssistant ? 16 : 0));
}
