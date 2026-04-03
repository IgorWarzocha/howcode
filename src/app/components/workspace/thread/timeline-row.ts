import type { TurnDiffSummary } from "../../../desktop/types";
import type { Message } from "../../../types";

export type ToolCallMessage = Extract<Message, { role: "toolResult" | "bashExecution" }>;

export type TimelineTurnItem =
  | {
      kind: "tool-group";
      id: string;
      messages: ToolCallMessage[];
    }
  | {
      kind: "message";
      id: string;
      message: Message;
      turnSummary?: TurnDiffSummary;
    };

export type TimelineRow =
  | {
      kind: "history-divider";
      id: string;
      hiddenCount: number;
    }
  | {
      kind: "turn";
      id: string;
      userMessage: Extract<Message, { role: "assistant" | "user" }> | null;
      items: TimelineTurnItem[];
    }
  | {
      kind: "summary";
      id: string;
      message: Extract<Message, { role: "branchSummary" | "compactionSummary" }>;
    }
  | TimelineTurnItem;

export function isToolCallMessage(message: Message): message is ToolCallMessage {
  return message.role === "toolResult" || message.role === "bashExecution";
}

export function isTurnRowCollapsible(row: Extract<TimelineRow, { kind: "turn" }>) {
  if (row.userMessage) {
    return row.items.length > 0;
  }

  if (row.items.length > 1) {
    return true;
  }

  const firstItem = row.items[0];
  if (!firstItem) {
    return false;
  }

  if (firstItem.kind === "tool-group") {
    return firstItem.messages.length > 1;
  }

  if (firstItem.message.role === "assistant") {
    const hasThinking = Boolean(
      firstItem.message.thinkingContent && firstItem.message.thinkingContent.length > 0,
    );
    return hasThinking && firstItem.message.content.length > 0;
  }

  return false;
}
