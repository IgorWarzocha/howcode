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
};

export function buildTimelineRows({
  messages,
  previousMessageCount,
}: BuildTimelineRowsInput): TimelineRow[] {
  const nextRows: TimelineRow[] = [];
  let pendingToolMessages: ToolCallMessage[] = [];
  let currentTurn: Extract<TimelineRow, { kind: "turn" }> | null = null;
  let pendingImplicitTurnId: string | null = null;

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
      currentTurn = {
        kind: "turn",
        id: pendingImplicitTurnId ?? `turn:implicit:${firstMessage?.id ?? "tool-group"}`,
        userMessage: null,
        items: [toolGroup],
      };
      pendingImplicitTurnId = null;
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
    };

    if (message.role === "user") {
      flushCurrentTurn();
      pendingImplicitTurnId = null;
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
      pendingImplicitTurnId =
        message.role === "compactionSummary" ? `turn:post-summary:${message.id}` : null;
      continue;
    }

    if (currentTurn) {
      currentTurn.items.push(timelineMessage);
    } else {
      currentTurn = {
        kind: "turn",
        id: pendingImplicitTurnId ?? `turn:implicit:${message.id}`,
        userMessage: null,
        items: [timelineMessage],
      };
      pendingImplicitTurnId = null;
    }
  }

  flushPendingToolMessages();
  flushCurrentTurn();

  return nextRows;
}
