import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import {
  CHAT_COLLAPSED_ROW_HEIGHT_PX,
  CHAT_HISTORY_DIVIDER_HEIGHT_PX,
  CHAT_ROW_GAP_PX,
} from "./thread-layout";
import type { TimelineRow, TimelineTurnItem } from "./timeline-row";

function estimateTextHeight(characters: number, charsPerLine: number, lineHeight: number) {
  const estimatedLines = Math.max(1, Math.ceil(characters / charsPerLine));
  return estimatedLines * lineHeight;
}

function estimateMessageBodyHeight(message: Message) {
  switch (message.role) {
    case "user":
      return 72 + estimateTextHeight(message.content.join(" ").length, 56, 24);
    case "assistant":
      return (
        64 +
        estimateTextHeight(message.content.join(" ").length, 54, 24) +
        (message.thinkingContent && message.thinkingContent.length > 0
          ? 96 + estimateTextHeight(message.thinkingContent.join(" ").length, 54, 22)
          : 0)
      );
    case "toolResult":
      return 96 + estimateTextHeight(message.content.join(" ").length, 54, 22);
    case "bashExecution":
      return (
        104 + estimateTextHeight([message.command, ...message.output].join(" ").length, 58, 18)
      );
    case "custom":
      return 88 + estimateTextHeight(message.content.join(" ").length, 56, 20);
    case "branchSummary":
    case "compactionSummary":
      return 88 + estimateTextHeight(message.content.join(" ").length, 56, 20);
    default:
      return 96;
  }
}

function estimateTurnSummaryHeight(turnSummary?: TurnDiffSummary) {
  if (!turnSummary || turnSummary.files.length === 0) {
    return 0;
  }

  const visibleFileRows = Math.min(turnSummary.files.length, 8);
  return 96 + visibleFileRows * 20;
}

function estimateTimelineItemHeight(item: TimelineTurnItem) {
  if (item.kind === "tool-group") {
    return item.messages.length * 40 + Math.max(0, item.messages.length - 1) * 8;
  }

  return (
    estimateMessageBodyHeight(item.message) +
    estimateTurnSummaryHeight(item.turnSummary) +
    CHAT_ROW_GAP_PX
  );
}

function estimateCollapsedTurnHeight(row: Extract<TimelineRow, { kind: "turn" }>) {
  const assistantPreview = row.items.find(
    (item) => item.kind === "message" && item.message.role === "assistant",
  ) as Extract<TimelineTurnItem, { kind: "message" }> | undefined;
  const combinedPreviewLength = [
    row.userMessage.content[0] ?? "",
    assistantPreview?.message.role === "assistant"
      ? (assistantPreview.message.thinkingHeaders?.join(", ") ??
        assistantPreview.message.content[0] ??
        "")
      : "",
  ]
    .join(" ")
    .trim().length;

  return CHAT_COLLAPSED_ROW_HEIGHT_PX + estimateTextHeight(combinedPreviewLength, 68, 20);
}

function estimateCollapsedSummaryHeight() {
  return CHAT_COLLAPSED_ROW_HEIGHT_PX;
}

export function estimateThreadTimelineRowHeight(
  row: TimelineRow,
  options?: { collapsed?: boolean },
) {
  if (row.kind === "history-divider") {
    return CHAT_HISTORY_DIVIDER_HEIGHT_PX;
  }

  if (row.kind === "turn") {
    if (options?.collapsed) {
      return estimateCollapsedTurnHeight(row);
    }

    return (
      estimateMessageBodyHeight(row.userMessage) +
      row.items.reduce((total, item) => total + estimateTimelineItemHeight(item), 0) +
      Math.max(0, row.items.length) * CHAT_ROW_GAP_PX +
      24
    );
  }

  if (row.kind === "summary") {
    if (options?.collapsed) {
      return estimateCollapsedSummaryHeight();
    }

    return estimateMessageBodyHeight(row.message) + 24;
  }

  return estimateTimelineItemHeight(row);
}
