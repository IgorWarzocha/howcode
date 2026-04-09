import type { Message } from "../../../types";
import { getAssistantPreview } from "../../../utils/thread-previews";
import type { TimelineRow, TimelineTurnItem } from "./timeline-row";

export function getMessagePreview(message: Message) {
  switch (message.role) {
    case "user":
    case "custom":
    case "branchSummary":
    case "compactionSummary":
      return message.content.join(" ").trim();
    case "assistant":
      return getAssistantPreview(message) ?? message.content.join(" ").trim();
    case "toolResult":
      return [message.toolName, message.content.join(" ")].filter(Boolean).join(" — ");
    case "bashExecution":
      return `$ ${message.command}`.trim();
    default:
      return "";
  }
}

function getToolGroupPreview(item: Extract<TimelineTurnItem, { kind: "tool-group" }>) {
  const firstMessage = item.messages[0];
  if (!firstMessage) {
    return "Tool call";
  }

  if (firstMessage.role === "toolResult") {
    return [firstMessage.toolName, firstMessage.content.join(" ")].filter(Boolean).join(" — ");
  }

  return `$ ${firstMessage.command}`.trim();
}

export function getCollapsedTurnPreview(row: Extract<TimelineRow, { kind: "turn" }>) {
  if (row.userMessage) {
    const primary = getMessagePreview(row.userMessage);
    const firstAssistantMessage = row.items.find(
      (item) => item.kind === "message" && item.message.role === "assistant",
    ) as Extract<TimelineTurnItem, { kind: "message" }> | undefined;

    return {
      label: primary,
      secondary: firstAssistantMessage ? getMessagePreview(firstAssistantMessage.message) : null,
      italicLabel: false,
    };
  }

  const firstItem = row.items[0];
  if (!firstItem) {
    return { label: "Continued turn", secondary: null, italicLabel: false };
  }

  if (firstItem.kind === "tool-group") {
    return { label: getToolGroupPreview(firstItem), secondary: null, italicLabel: false };
  }

  return {
    label: getMessagePreview(firstItem.message),
    secondary: null,
    italicLabel: firstItem.message.role === "assistant",
  };
}
