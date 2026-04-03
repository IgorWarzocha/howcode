import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ArchivedThread, Thread, ThreadData } from "../../shared/desktop-contracts";
import { getPreviousMessageCount } from "../../shared/pi-message-mapper";
import { buildThreadData } from "../../shared/thread-data";
import { getLiveThread } from "../pi-desktop-runtime";
import { getPiModule } from "../pi-module";
import {
  ensureProject,
  listArchivedThreads,
  listProjectThreads,
  listTurnDiffSummaries,
} from "../thread-state-db";

export type LoadedThreadSnapshot = {
  projectId: string;
  threadId: string;
  thread: ThreadData;
};

type SessionPathEntry = {
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

function countHiddenMessagesBeforeCompaction(
  pathEntries: SessionPathEntry[],
  compactionIndex: number,
) {
  const firstKeptEntryId = pathEntries[compactionIndex]?.firstKeptEntryId;
  if (!firstKeptEntryId) {
    return 0;
  }

  let count = 0;
  for (let index = 0; index < compactionIndex; index += 1) {
    const entry = pathEntries[index];
    if (entry?.id === firstKeptEntryId) {
      break;
    }

    if (
      entry?.type === "message" ||
      entry?.type === "custom_message" ||
      entry?.type === "branch_summary"
    ) {
      count += 1;
    }
  }

  return count;
}

function buildHistorySliceForCompactionDepth(
  pathEntries: SessionPathEntry[],
  historyCompactions: number,
) {
  if (historyCompactions <= 0) {
    return null;
  }

  const compactionIndexes = pathEntries.flatMap((entry, index) =>
    entry.type === "compaction" ? [index] : [],
  );

  if (compactionIndexes.length === 0) {
    return {
      sourceMessages: buildFullHistorySourceMessages(pathEntries),
      previousMessageCount: 0,
    };
  }

  if (historyCompactions >= compactionIndexes.length) {
    return {
      sourceMessages: buildFullHistorySourceMessages(pathEntries),
      previousMessageCount: 0,
    };
  }

  const selectedCompactionIndex =
    compactionIndexes[compactionIndexes.length - 1 - historyCompactions];
  const selectedCompactionEntry = pathEntries[selectedCompactionIndex];
  const firstKeptIndex = selectedCompactionEntry?.firstKeptEntryId
    ? pathEntries.findIndex((entry) => entry.id === selectedCompactionEntry.firstKeptEntryId)
    : -1;

  if (!selectedCompactionEntry || firstKeptIndex === -1) {
    return {
      sourceMessages: buildFullHistorySourceMessages(pathEntries),
      previousMessageCount: 0,
    };
  }

  return {
    sourceMessages: buildFullHistorySourceMessages([
      selectedCompactionEntry,
      ...pathEntries.filter(
        (_, index) => index >= firstKeptIndex && index !== selectedCompactionIndex,
      ),
    ]),
    previousMessageCount: countHiddenMessagesBeforeCompaction(pathEntries, selectedCompactionIndex),
  };
}

function buildFullHistorySourceMessages(pathEntries: SessionPathEntry[]): AgentMessage[] {
  const messages: AgentMessage[] = [];

  for (const entry of pathEntries) {
    switch (entry.type) {
      case "message":
        if (entry.message) {
          messages.push(entry.message);
        }
        break;
      case "custom_message":
        if (entry.display === false) {
          break;
        }

        messages.push({
          role: "custom",
          customType: entry.customType ?? "custom",
          content: entry.content ?? "",
          timestamp: entry.timestamp ?? Date.now(),
        } as AgentMessage);
        break;
      case "branch_summary":
        if (!entry.summary?.trim()) {
          break;
        }

        messages.push({
          role: "branchSummary",
          summary: entry.summary,
          timestamp: entry.timestamp ?? Date.now(),
        } as AgentMessage);
        break;
      case "compaction":
        if (!entry.summary?.trim()) {
          break;
        }

        messages.push({
          role: "compactionSummary",
          summary: entry.summary,
          tokensBefore: entry.tokensBefore ?? 0,
          timestamp: entry.timestamp ?? Date.now(),
        } as AgentMessage);
        break;
    }
  }

  return messages;
}

export async function loadProjectThreads(projectId: string): Promise<Thread[]> {
  ensureProject(projectId);
  return listProjectThreads(projectId);
}

export async function loadArchivedThreadList(): Promise<ArchivedThread[]> {
  return listArchivedThreads();
}

export async function loadThreadSnapshot(
  sessionPath: string,
  options?: { historyCompactions?: number },
): Promise<LoadedThreadSnapshot> {
  const { SessionManager } = await getPiModule();
  const manager = SessionManager.open(sessionPath);
  const previousMessageCount = getPreviousMessageCount(manager.getBranch());
  const historyCompactions = options?.historyCompactions ?? 0;
  const pathEntries = [...(manager.getBranch() as SessionPathEntry[])];
  const historySlice = buildHistorySliceForCompactionDepth(pathEntries, historyCompactions);
  const sourceMessages = historySlice
    ? historySlice.sourceMessages
    : (manager.buildSessionContext().messages as AgentMessage[]);

  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    thread: buildThreadData({
      sessionPath,
      sourceMessages,
      previousMessageCount: historySlice ? historySlice.previousMessageCount : previousMessageCount,
      isStreaming: false,
      turnDiffSummaries: listTurnDiffSummaries(sessionPath),
    }),
  };
}

export async function loadThread(
  sessionPath: string,
  options?: { historyCompactions?: number },
): Promise<ThreadData> {
  const liveThread = getLiveThread(sessionPath);
  if (liveThread?.isStreaming && (options?.historyCompactions ?? 0) === 0) {
    return liveThread;
  }

  return (await loadThreadSnapshot(sessionPath, options)).thread;
}
