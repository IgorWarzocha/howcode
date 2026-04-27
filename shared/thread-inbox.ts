import type { Message, ProseMessage } from "./desktop-contracts";

type AssistantMessage = ProseMessage & { role: "assistant" };

export function getLatestInboxAssistantMessage(messages: Message[]) {
  let lastUserMessageIndex: number | undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      lastUserMessageIndex = index;
      break;
    }
  }

  const turnMessages =
    typeof lastUserMessageIndex === "number" ? messages.slice(lastUserMessageIndex + 1) : messages;

  let latestAssistantMessage: AssistantMessage | undefined;
  for (let index = turnMessages.length - 1; index >= 0; index -= 1) {
    const message = turnMessages[index];
    if (message?.role === "assistant" && message.content.some((part) => part.trim().length > 0)) {
      latestAssistantMessage = message as AssistantMessage;
      break;
    }
  }

  if (!latestAssistantMessage) {
    return null;
  }

  const content = latestAssistantMessage.content.map((part) => part.trim()).filter(Boolean);
  if (content.length === 0) {
    return null;
  }

  const latestAssistantIndex = turnMessages.lastIndexOf(latestAssistantMessage);
  const hasLaterTurnWork = turnMessages.slice(latestAssistantIndex + 1).some((message) => {
    return (
      message.role === "assistant" ||
      message.role === "user" ||
      message.role === "toolResult" ||
      message.role === "bashExecution"
    );
  });

  if (hasLaterTurnWork) {
    return null;
  }

  return {
    content,
    preview: content[0] ?? null,
  };
}
