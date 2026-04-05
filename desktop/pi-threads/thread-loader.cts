import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ArchivedThread, Thread, ThreadData } from "../../shared/desktop-contracts.ts";
import { getPreviousMessageCount } from "../../shared/pi-message-mapper.ts";
import { buildThreadData } from "../../shared/thread-data.ts";
import { type SessionPathEntry, buildThreadHistorySlice } from "../../shared/thread-history.ts";
import { getLiveThread } from "../pi-desktop-runtime.cts";
import { getPiModule } from "../pi-module.cts";
import {
  ensureProject,
  listArchivedThreads,
  listProjectThreads,
  listTurnDiffSummaries,
} from "../thread-state-db.cts";

export type LoadedThreadSnapshot = {
  projectId: string;
  threadId: string;
  thread: ThreadData;
};

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
  const historyCompactions = options?.historyCompactions ?? 0;
  const pathEntries = [...(manager.getBranch() as SessionPathEntry[])];
  const historySlice = buildThreadHistorySlice(pathEntries, historyCompactions);

  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    thread: buildThreadData({
      sessionPath,
      sourceMessages: historySlice.sourceMessages,
      previousMessageCount: historySlice.previousMessageCount,
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
