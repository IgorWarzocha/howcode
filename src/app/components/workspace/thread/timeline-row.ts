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
