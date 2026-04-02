import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";

type TimelineRow =
  | {
      kind: "history-divider";
    }
  | {
      kind: "message";
      message: Message;
      turnSummary?: TurnDiffSummary;
    };

function estimateTextHeight(characters: number, charsPerLine: number, lineHeight: number) {
  const estimatedLines = Math.max(1, Math.ceil(characters / charsPerLine));
  return estimatedLines * lineHeight;
}

function estimateMessageBodyHeight(message: Message) {
  switch (message.role) {
    case "user":
      return 44 + estimateTextHeight(message.content.join(" ").length, 56, 22);
    case "assistant":
      return 28 + estimateTextHeight(message.content.join(" ").length, 68, 24);
    case "toolResult":
      return 72 + estimateTextHeight(message.content.join(" ").length, 64, 20);
    case "bashExecution":
      return 84 + estimateTextHeight([message.command, ...message.output].join(" ").length, 70, 18);
    case "custom":
      return 72 + estimateTextHeight(message.content.join(" ").length, 66, 20);
    case "branchSummary":
    case "compactionSummary":
      return 72 + estimateTextHeight(message.content.join(" ").length, 66, 20);
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

export function estimateThreadTimelineRowHeight(row: TimelineRow) {
  if (row.kind === "history-divider") {
    return 42;
  }

  return estimateMessageBodyHeight(row.message) + estimateTurnSummaryHeight(row.turnSummary) + 18;
}
