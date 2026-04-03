import type { AgentMessage } from "@mariozechner/pi-agent-core";

export type SessionPathEntry = {
  type: string;
  id: string;
  timestamp?: string | number;
  message?: AgentMessage;
  customType?: string;
  content?: string | unknown[];
  display?: boolean;
  summary?: string;
  tokensBefore?: number;
  firstKeptEntryId?: string;
};

function countDisplayableEntries(entries: SessionPathEntry[]) {
  let count = 0;

  for (const entry of entries) {
    if (
      entry.type === "message" ||
      entry.type === "custom_message" ||
      entry.type === "branch_summary"
    ) {
      count += 1;
    }
  }

  return count;
}

function appendEntryMessage(messages: AgentMessage[], entry: SessionPathEntry) {
  switch (entry.type) {
    case "message":
      if (entry.message) {
        messages.push(entry.message);
      }
      return;
    case "custom_message":
      if (entry.display === false) {
        return;
      }

      messages.push({
        role: "custom",
        customType: entry.customType ?? "custom",
        content: entry.content ?? "",
        timestamp: entry.timestamp ?? Date.now(),
      } as unknown as AgentMessage);
      return;
    case "branch_summary":
      if (!entry.summary?.trim()) {
        return;
      }

      messages.push({
        role: "branchSummary",
        summary: entry.summary,
        timestamp: entry.timestamp ?? Date.now(),
      } as unknown as AgentMessage);
      return;
    case "compaction":
      if (!entry.summary?.trim()) {
        return;
      }

      messages.push({
        role: "compactionSummary",
        summary: entry.summary,
        tokensBefore: entry.tokensBefore ?? 0,
        timestamp: entry.timestamp ?? Date.now(),
      } as unknown as AgentMessage);
  }
}

export function buildSourceMessagesFromPathEntries(pathEntries: SessionPathEntry[]) {
  const messages: AgentMessage[] = [];

  for (const entry of pathEntries) {
    appendEntryMessage(messages, entry);
  }

  return messages;
}

export function buildThreadHistorySlice(
  pathEntries: SessionPathEntry[],
  revealedCompactions: number,
) {
  const compactionIndexes = pathEntries.flatMap((entry, index) =>
    entry.type === "compaction" ? [index] : [],
  );

  if (compactionIndexes.length === 0) {
    return {
      sourceMessages: buildSourceMessagesFromPathEntries(pathEntries),
      previousMessageCount: 0,
    };
  }

  const selectedCompactionListIndex = compactionIndexes.length - 1 - revealedCompactions;
  if (selectedCompactionListIndex < 0) {
    return {
      sourceMessages: buildSourceMessagesFromPathEntries(pathEntries),
      previousMessageCount: 0,
    };
  }

  const selectedCompactionIndex = compactionIndexes[selectedCompactionListIndex];
  const selectedCompaction = pathEntries[selectedCompactionIndex];
  const firstKeptEntryId = selectedCompaction?.firstKeptEntryId;
  const firstKeptIndex = firstKeptEntryId
    ? pathEntries.findIndex((entry) => entry.id === firstKeptEntryId)
    : -1;

  if (!selectedCompaction || firstKeptIndex === -1 || firstKeptIndex > selectedCompactionIndex) {
    return {
      sourceMessages: buildSourceMessagesFromPathEntries(pathEntries),
      previousMessageCount: 0,
    };
  }

  return {
    sourceMessages: buildSourceMessagesFromPathEntries([
      selectedCompaction,
      ...pathEntries.slice(firstKeptIndex, selectedCompactionIndex),
      ...pathEntries.slice(selectedCompactionIndex + 1),
    ]),
    previousMessageCount: countDisplayableEntries(pathEntries.slice(0, firstKeptIndex)),
  };
}
