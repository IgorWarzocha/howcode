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

  if (row.items.length === 0) {
    return false;
  }

  if (row.items.length > 1) {
    return true;
  }

  const [onlyItem] = row.items;
  if (!onlyItem) {
    return false;
  }

  if (onlyItem.kind === "tool-group") {
    return true;
  }

  if (onlyItem.message.role !== "assistant") {
    return true;
  }

  return Boolean(onlyItem.message.thinkingContent?.length);
}
