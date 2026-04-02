import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Message } from "../shared/desktop-contracts.js";

type TextPart = {
  type?: string;
  text?: string;
};

type ImagePart = {
  type?: string;
  mimeType?: string;
};

type ToolCallPart = {
  type?: string;
  name?: string;
};

type RuntimeMessage = {
  role?: string;
  content?: string | Array<TextPart | ImagePart | ToolCallPart>;
  timestamp?: string | number;
  errorMessage?: string;
  toolName?: string;
  isError?: boolean;
  command?: string;
  output?: string;
  exitCode?: number;
  cancelled?: boolean;
  truncated?: boolean;
  customType?: string;
  summary?: string;
};

function splitParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getTextParts(content: RuntimeMessage["content"]) {
  if (!Array.isArray(content)) {
    return [] as string[];
  }

  return content
    .filter((part) => part?.type === "text" && typeof (part as TextPart).text === "string")
    .map((part) => (part as TextPart).text ?? "");
}

function getImageCount(content: RuntimeMessage["content"]) {
  if (!Array.isArray(content)) {
    return 0;
  }

  return content.filter((part) => part?.type === "image").length;
}

function extractUserContent(content: RuntimeMessage["content"]) {
  if (typeof content === "string") {
    return content.trim() ? [content.trim()] : [];
  }

  if (!Array.isArray(content)) {
    return [] as string[];
  }

  const text = getTextParts(content).join("\n").trim();
  const imageCount = getImageCount(content);
  const imageLabels = Array.from(
    { length: imageCount },
    (_, index) => `Attached image ${index + 1}`,
  );

  return [text, ...imageLabels].filter(Boolean);
}

function extractAssistantContent(message: RuntimeMessage) {
  const content = getTextParts(message.content)
    .flatMap((part) => splitParagraphs(part))
    .filter(Boolean);

  if (content.length > 0) {
    return content;
  }

  if (message.errorMessage) {
    return [message.errorMessage];
  }

  return [] as string[];
}

export function normalizeThreadTitle(value: unknown) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return "New thread";
  }

  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

export function mapAgentMessageToUiMessage(message: AgentMessage, index: number): Message | null {
  const runtimeMessage = message as RuntimeMessage;
  const id = `${runtimeMessage.timestamp ?? index}-${runtimeMessage.role ?? "message"}-${index}`;

  switch (runtimeMessage.role) {
    case "user": {
      const content = extractUserContent(runtimeMessage.content);
      if (content.length === 0) {
        return null;
      }

      return {
        id,
        role: "user",
        content,
      };
    }

    case "assistant": {
      const content = extractAssistantContent(runtimeMessage);
      if (content.length === 0) {
        return null;
      }

      return {
        id,
        role: "assistant",
        content,
      };
    }

    case "toolResult": {
      const text = extractUserContent(runtimeMessage.content);
      return {
        id,
        role: "toolResult",
        toolName: runtimeMessage.toolName ?? "tool",
        content:
          text.length > 0 ? text : [runtimeMessage.isError ? "Tool failed." : "Tool finished."],
        isError: Boolean(runtimeMessage.isError),
      };
    }

    case "bashExecution": {
      return {
        id,
        role: "bashExecution",
        command: runtimeMessage.command ?? "",
        output: splitParagraphs(runtimeMessage.output ?? "").slice(0, 12),
        exitCode: runtimeMessage.exitCode ?? null,
        cancelled: Boolean(runtimeMessage.cancelled),
        truncated: Boolean(runtimeMessage.truncated),
      };
    }

    case "custom": {
      const content = extractUserContent(runtimeMessage.content);
      if (content.length === 0) {
        return null;
      }

      return {
        id,
        role: "custom",
        customType: runtimeMessage.customType ?? "custom",
        content,
      };
    }

    case "branchSummary":
    case "compactionSummary": {
      if (!runtimeMessage.summary?.trim()) {
        return null;
      }

      return {
        id,
        role: runtimeMessage.role,
        content: splitParagraphs(runtimeMessage.summary),
      };
    }

    default:
      return null;
  }
}

export function mapAgentMessagesToUiMessages(messages: AgentMessage[]) {
  return messages
    .map((message, index) => mapAgentMessageToUiMessage(message, index))
    .filter((message): message is Message => message !== null);
}

export function getFirstUserTurnTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user") as
    | Extract<Message, { role: "assistant" | "user" }>
    | undefined;
  return normalizeThreadTitle(firstUserMessage?.content[0]);
}
