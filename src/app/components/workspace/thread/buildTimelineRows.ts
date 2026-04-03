import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";
import {
  type TimelineRow,
  type TimelineTurnItem,
  type ToolCallMessage,
  isToolCallMessage,
} from "./timeline-row";

type BuildTimelineRowsInput = {
  messages: Message[];
  previousMessageCount: number;
  turnDiffSummaries: TurnDiffSummary[];
};

export function buildTimelineRows({
  messages,
  previousMessageCount,
  turnDiffSummaries,
}: BuildTimelineRowsInput): TimelineRow[] {
  const nextRows: TimelineRow[] = [];
  const turnDiffSummaryByAssistantMessageId = new Map(
    turnDiffSummaries
      .filter((summary) => summary.assistantMessageId)
      .map((summary) => [summary.assistantMessageId as string, summary]),
  );
  let pendingToolMessages: ToolCallMessage[] = [];
  let currentTurn: Extract<TimelineRow, { kind: "turn" }> | null = null;

  const flushPendingToolMessages = () => {
    if (pendingToolMessages.length === 0) {
      return;
    }

    const firstMessage = pendingToolMessages[0];
    const lastMessage = pendingToolMessages[pendingToolMessages.length - 1];
    const toolGroup: Extract<TimelineTurnItem, { kind: "tool-group" }> = {
      kind: "tool-group",
      id: `tool-group:${firstMessage?.id ?? "start"}:${lastMessage?.id ?? "end"}:${pendingToolMessages.length}`,
      messages: pendingToolMessages,
    };

    if (currentTurn) {
      currentTurn.items.push(toolGroup);
    } else {
      nextRows.push(toolGroup);
    }

    pendingToolMessages = [];
  };

  const flushCurrentTurn = () => {
    if (!currentTurn) {
      return;
    }

    nextRows.push(currentTurn);
    currentTurn = null;
  };

  if (previousMessageCount > 0) {
    nextRows.push({
      kind: "history-divider",
      id: `history-divider:${previousMessageCount}`,
      hiddenCount: previousMessageCount,
    });
  }

  for (const message of messages) {
    if (isToolCallMessage(message)) {
      pendingToolMessages.push(message);
      continue;
    }

    flushPendingToolMessages();

    const timelineMessage: Extract<TimelineTurnItem, { kind: "message" }> = {
      kind: "message",
      id: message.id,
      message,
      turnSummary:
        message.role === "assistant"
          ? turnDiffSummaryByAssistantMessageId.get(message.id)
          : undefined,
    };

    if (message.role === "user") {
      flushCurrentTurn();
      currentTurn = {
        kind: "turn",
        id: `turn:${message.id}`,
        userMessage: message,
        items: [],
      };
      continue;
    }

    if (message.role === "branchSummary" || message.role === "compactionSummary") {
      flushCurrentTurn();
      nextRows.push({
        kind: "summary",
        id: `summary:${message.id}`,
        message,
      });
      continue;
    }

    if (currentTurn) {
      currentTurn.items.push(timelineMessage);
    } else {
      nextRows.push(timelineMessage);
    }
  }

  flushPendingToolMessages();
  flushCurrentTurn();

  return nextRows;
}
