import type {
  ArchivedThread,
  InboxThread,
  Thread,
  ThreadData,
} from "../../shared/desktop-contracts.ts";
import { getLiveThread } from "../pi-desktop-runtime.cts";
import { invokeRuntimeHost } from "../runtime-host/client-bridge.cts";
import {
  ensureProject,
  getThreadDiffPreferences,
  listArchivedThreads,
  listInboxThreads,
  listProjectThreads,
  upsertInboxThreadPrompt,
} from "../thread-state-db.cts";
import { mapWithConcurrency } from "./map-with-concurrency.cts";

export type LoadedThreadSnapshot = {
  projectId: string;
  threadId: string;
  thread: ThreadData;
};

function attachThreadDiffPreferences(thread: ThreadData): ThreadData {
  return {
    ...thread,
    diffPreferences: getThreadDiffPreferences(thread.sessionPath),
  };
}

const INBOX_PROMPT_BACKFILL_CONCURRENCY = 6;

export async function loadProjectThreads(
  projectId: string,
  options: { chat?: boolean } = {},
): Promise<Thread[]> {
  ensureProject(projectId);
  return listProjectThreads(projectId, options);
}

export async function loadArchivedThreadList(): Promise<ArchivedThread[]> {
  return listArchivedThreads();
}

export async function loadInboxThreadList(): Promise<InboxThread[]> {
  const threads = listInboxThreads();

  return mapWithConcurrency(threads, INBOX_PROMPT_BACKFILL_CONCURRENCY, async (thread) => {
    try {
      if (thread.prompt?.trim()) {
        return thread;
      }

      const loadedThread = await loadThread(thread.sessionPath);
      let prompt: string | null = null;

      for (let index = loadedThread.messages.length - 1; index >= 0; index -= 1) {
        const message = loadedThread.messages[index];
        if (message.role === "user") {
          const nextPrompt = message.content.join("\n\n").trim();
          prompt = nextPrompt.length > 0 ? nextPrompt : null;
          break;
        }
      }

      if (!prompt) {
        return thread;
      }

      upsertInboxThreadPrompt(thread.sessionPath, prompt);
      return { ...thread, prompt };
    } catch (error) {
      console.warn(`Failed to backfill inbox prompt for ${thread.sessionPath}.`, error);
      return thread;
    }
  });
}

export async function loadThreadSnapshot(
  sessionPath: string,
  options?: { historyCompactions?: number },
): Promise<LoadedThreadSnapshot> {
  const snapshot = await invokeRuntimeHost("loadThreadSnapshot", {
    sessionPath,
    historyCompactions: options?.historyCompactions,
  });

  return {
    ...snapshot,
    thread: attachThreadDiffPreferences(snapshot.thread),
  };
}

export async function loadThread(
  sessionPath: string,
  options?: { historyCompactions?: number },
): Promise<ThreadData> {
  const liveThread = getLiveThread(sessionPath);
  if (
    (liveThread?.isStreaming || liveThread?.isCompacting) &&
    (options?.historyCompactions ?? 0) === 0
  ) {
    return attachThreadDiffPreferences(liveThread);
  }

  return (await loadThreadSnapshot(sessionPath, options)).thread;
}
