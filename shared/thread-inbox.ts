import type { Message, ProseMessage } from "./desktop-contracts";

type AssistantMessage = ProseMessage & { role: "assistant" };

export function getLatestInboxAssistantMessage(messages: Message[]) {
  let turnStartIndex = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      turnStartIndex = index + 1;
      break;
    }
  }

  let latestAssistantMessage: AssistantMessage | undefined;
  let latestAssistantIndex = -1;
  for (let index = messages.length - 1; index >= turnStartIndex; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant" && message.content.some((part) => part.trim().length > 0)) {
      latestAssistantMessage = message as AssistantMessage;
      latestAssistantIndex = index;
      break;
    }
  }

  if (!latestAssistantMessage) {
    return null;
  }

  const content: string[] = [];
  for (const part of latestAssistantMessage.content) {
    const trimmedPart = part.trim();
    if (trimmedPart) {
      content.push(trimmedPart);
    }
  }

  if (content.length === 0) {
    return null;
  }

  let hasLaterTurnWork = false;
  for (let index = latestAssistantIndex + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (
      message.role === "assistant" ||
      message.role === "user" ||
      message.role === "toolResult" ||
      message.role === "bashExecution"
    ) {
      hasLaterTurnWork = true;
      break;
    }
  }

  if (hasLaterTurnWork) {
    return null;
  }

  return {
    content,
    preview: content[0] ?? null,
  };
}
