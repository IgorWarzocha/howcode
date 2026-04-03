import type { ArchivedThread, Thread, ThreadData } from "../../shared/desktop-contracts";
import {
  getFirstUserTurnTitle,
  getPreviousMessageCount,
  mapAgentMessagesToUiMessages,
} from "../../shared/pi-message-mapper";
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
  const messages = mapAgentMessagesToUiMessages(sessionContext.messages);
  const title = getFirstUserTurnTitle(messages);

  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    thread: {
      sessionPath,
      title,
      messages,
      previousMessageCount,
      isStreaming: false,
      turnDiffSummaries: listTurnDiffSummaries(sessionPath),
    },
  };
}

export async function loadThread(sessionPath: string): Promise<ThreadData> {
  const liveThread = getLiveThread(sessionPath);
  if (liveThread?.isStreaming) {
    return liveThread;
  }

  return (await loadThreadSnapshot(sessionPath)).thread;
}
