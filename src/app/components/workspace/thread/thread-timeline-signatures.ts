import type { Message } from "../../../types";
import type { TimelineRow } from "./timeline-row";

export function getMessageRenderSignature(message: Message | undefined) {
  if (!message) {
    return "empty";
  }

  switch (message.role) {
    case "user":
    case "toolResult":
    case "custom":
    case "branchSummary":
    case "compactionSummary":
      return `${message.id}:${message.role}:${message.content.join("\n").length}`;
    case "assistant":
      return `${message.id}:${message.role}:${message.content.join("\n").length}:${message.thinkingContent?.join("\n").length ?? 0}:${message.thinkingHeaders?.join(",").length ?? 0}`;
    case "bashExecution":
      return `${message.id}:${message.role}:${message.command.length}:${message.output.join("\n").length}`;
    default:
      return "unknown";
  }
}

export function getStreamingAssistantMessageId(messages: Message[], isStreaming: boolean) {
  if (!isStreaming) {
    return null;
  }

  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  return latestAssistantMessage?.id ?? null;
}

export function getRowStructureSignature(
  rows: TimelineRow[],
  collapsedRowIds: Record<string, boolean>,
) {
  return rows
    .map((row) => {
      if (row.kind === "history-divider") {
        return `${row.id}:${row.hiddenCount}`;
      }

      if (row.kind === "turn") {
        return `${row.id}:${collapsedRowIds[row.id] ? "collapsed" : "expanded"}:${row.items.length}`;
      }

      if (row.kind === "summary") {
        return `${row.id}:${collapsedRowIds[row.id] ? "collapsed" : "expanded"}`;
      }

      if (row.kind === "tool-group") {
        return `${row.id}:${row.messages.length}`;
      }

      return `${row.id}:${row.turnSummary?.files.length ?? 0}`;
    })
    .join("||");
}

export function getFoldableRows(rows: TimelineRow[]) {
  return rows.filter(
    (row): row is Extract<TimelineRow, { kind: "turn" | "summary" }> =>
      row.kind === "turn" || row.kind === "summary",
  );
}

export function getCollapsibleRowKey(row: TimelineRow, collapsedRowIds: Record<string, boolean>) {
  return row.kind === "turn" || row.kind === "summary"
    ? `${row.id}:${collapsedRowIds[row.id] ? "collapsed" : "expanded"}`
    : row.id;
}
