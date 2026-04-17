import type { Message, ProseMessage } from "./desktop-contracts";

type AssistantMessage = ProseMessage & { role: "assistant" };

export function getLatestInboxAssistantMessage(messages: Message[]) {
  const lastUserMessageIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "user")?.index;

  const turnMessages =
    typeof lastUserMessageIndex === "number" ? messages.slice(lastUserMessageIndex + 1) : messages;

  const latestAssistantMessage = [...turnMessages]
    .reverse()
    .find((message): message is AssistantMessage => {
      if (message.role !== "assistant") {
        return false;
      }

      return message.content.some((part) => part.trim().length > 0);
    });

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
