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

export async function loadProjectThreads(projectId: string): Promise<Thread[]> {
  ensureProject(projectId);
  return listProjectThreads(projectId);
}

export async function loadArchivedThreadList(): Promise<ArchivedThread[]> {
  return listArchivedThreads();
}

export async function loadThreadSnapshot(sessionPath: string): Promise<LoadedThreadSnapshot> {
  const { SessionManager } = await getPiModule();
  const manager = SessionManager.open(sessionPath);
  const previousMessageCount = getPreviousMessageCount(manager.getBranch());
  const sessionContext = manager.buildSessionContext();

  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    thread: buildThreadData({
      sessionPath,
      sourceMessages: sessionContext.messages as AgentMessage[],
      previousMessageCount,
      isStreaming: false,
      turnDiffSummaries: listTurnDiffSummaries(sessionPath),
    }),
  };
}

export async function loadThread(sessionPath: string): Promise<ThreadData> {
  const liveThread = getLiveThread(sessionPath);
  if (liveThread?.isStreaming) {
    return liveThread;
  }

  return (await loadThreadSnapshot(sessionPath)).thread;
}
