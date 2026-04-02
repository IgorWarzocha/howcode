import { stat } from "node:fs/promises";
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
  getCachedThread,
  listArchivedThreads,
  listProjectThreads,
  saveThreadCache,
} from "../thread-state-db";

export async function loadProjectThreads(projectId: string): Promise<Thread[]> {
  ensureProject(projectId);
  return listProjectThreads(projectId);
}

export async function loadArchivedThreadList(): Promise<ArchivedThread[]> {
  return listArchivedThreads();
}

export async function loadThread(sessionPath: string): Promise<ThreadData> {
  const liveThread = getLiveThread(sessionPath);
  if (liveThread) {
    return liveThread;
  }

  const cachedThread = getCachedThread(sessionPath);
  const fileStats = await stat(sessionPath);
  const currentModifiedMs = Math.floor(fileStats.mtimeMs);
  const { SessionManager } = await getPiModule();
  const manager = SessionManager.open(sessionPath);
  const previousMessageCount = getPreviousMessageCount(manager.getBranch());

  if (
    cachedThread?.messages &&
    cachedThread.hydratedModifiedMs !== null &&
    cachedThread.hydratedModifiedMs >= currentModifiedMs
  ) {
    return {
      sessionPath,
      title: cachedThread.title,
      messages: cachedThread.messages,
      previousMessageCount,
      isStreaming: false,
    };
  }

  const sessionContext = manager.buildSessionContext();
  const messages = mapAgentMessagesToUiMessages(sessionContext.messages);
  const title = cachedThread?.title || getFirstUserTurnTitle(messages);

  saveThreadCache(sessionPath, title, messages, currentModifiedMs);

  return {
    sessionPath,
    title,
    messages,
    previousMessageCount,
    isStreaming: false,
  };
}
