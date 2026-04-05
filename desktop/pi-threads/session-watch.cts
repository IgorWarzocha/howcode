import { type FSWatcher, watch } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  publishExternalThreadUpdate,
  shouldSuppressExternalThreadUpdate,
} from "../runtime/thread-publisher.cts";
import { loadThreadSnapshot } from "./thread-loader.cts";

const WATCH_DEBOUNCE_MS = 140;

let currentSessionPath: string | null = null;
let currentWatcher: FSWatcher | null = null;
let currentWatchToken = 0;
let lastObservedModifiedMs = 0;
let pendingRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

function clearPendingRefresh() {
  if (!pendingRefreshTimeout) {
    return;
  }

  clearTimeout(pendingRefreshTimeout);
  pendingRefreshTimeout = null;
}

function closeCurrentWatcher() {
  clearPendingRefresh();
  currentWatcher?.close();
  currentWatcher = null;
}

async function refreshWatchedSession(sessionPath: string, watchToken: number) {
  if (currentSessionPath !== sessionPath || currentWatchToken !== watchToken) {
    return;
  }

  if (shouldSuppressExternalThreadUpdate(sessionPath)) {
    return;
  }

  let fileStats: Awaited<ReturnType<typeof stat>>;

  try {
    fileStats = await stat(sessionPath);
  } catch {
    return;
  }

  if (fileStats.mtimeMs <= lastObservedModifiedMs) {
    return;
  }

  try {
    const snapshot = await loadThreadSnapshot(sessionPath);
    if (currentSessionPath !== sessionPath || currentWatchToken !== watchToken) {
      return;
    }

    lastObservedModifiedMs = fileStats.mtimeMs;
    await publishExternalThreadUpdate({
      projectId: snapshot.projectId,
      threadId: snapshot.threadId,
      sessionPath,
      thread: snapshot.thread,
      lastModifiedMs: fileStats.mtimeMs,
    });
  } catch (error) {
    console.warn(`Failed to refresh watched Pi session: ${sessionPath}`, error);
  }
}

function scheduleWatchedSessionRefresh(sessionPath: string, watchToken: number) {
  clearPendingRefresh();
  pendingRefreshTimeout = setTimeout(() => {
    pendingRefreshTimeout = null;
    void refreshWatchedSession(sessionPath, watchToken);
  }, WATCH_DEBOUNCE_MS);
}

export async function setWatchedSessionPath(sessionPath: string | null) {
  if (sessionPath === currentSessionPath) {
    return;
  }

  currentWatchToken += 1;
  currentSessionPath = sessionPath;
  lastObservedModifiedMs = 0;
  closeCurrentWatcher();

  if (!sessionPath) {
    return;
  }

  try {
    const fileStats = await stat(sessionPath);
    lastObservedModifiedMs = fileStats.mtimeMs;
  } catch {
    lastObservedModifiedMs = 0;
  }

  const watchToken = currentWatchToken;
  const watchedFileName = path.basename(sessionPath);
  const watchedDirectory = path.dirname(sessionPath);

  currentWatcher = watch(watchedDirectory, (_eventType, changedFileName) => {
    if (currentSessionPath !== sessionPath || currentWatchToken !== watchToken) {
      return;
    }

    if (typeof changedFileName === "string" && changedFileName.length > 0) {
      if (changedFileName !== watchedFileName) {
        return;
      }
    }

    scheduleWatchedSessionRefresh(sessionPath, watchToken);
  });

  currentWatcher.on("error", (error) => {
    console.warn(`Pi session watcher failed for ${sessionPath}`, error);
  });
}
