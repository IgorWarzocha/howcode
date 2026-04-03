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
  timestamp?: string | number;
  message?: AgentMessage;
  customType?: string;
  content?: string | unknown[];
  display?: boolean;
  summary?: string;
  tokensBefore?: number;
};

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
  options?: { includeHistory?: boolean },
): Promise<LoadedThreadSnapshot> {
  const { SessionManager } = await getPiModule();
  const manager = SessionManager.open(sessionPath);
  const previousMessageCount = getPreviousMessageCount(manager.getBranch());
  const includeHistory = options?.includeHistory ?? false;
  const sourceMessages = includeHistory
    ? buildFullHistorySourceMessages(manager.getPath() as SessionPathEntry[])
    : (manager.buildSessionContext().messages as AgentMessage[]);

  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    thread: buildThreadData({
      sessionPath,
      sourceMessages,
      previousMessageCount: includeHistory ? 0 : previousMessageCount,
      isStreaming: false,
      turnDiffSummaries: listTurnDiffSummaries(sessionPath),
    }),
  };
}

export async function loadThread(
  sessionPath: string,
  options?: { includeHistory?: boolean },
): Promise<ThreadData> {
  const liveThread = getLiveThread(sessionPath);
  if (liveThread?.isStreaming && !options?.includeHistory) {
    return liveThread;
  }

  return (await loadThreadSnapshot(sessionPath, options)).thread;
}
