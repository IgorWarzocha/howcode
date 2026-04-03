import type { ThreadData } from "../../shared/desktop-contracts";

const liveThreads = new Map<string, ThreadData>();
const recentInternalThreadUpdateAt = new Map<string, number>();

const EXTERNAL_UPDATE_SUPPRESSION_MS = 500;

export function markInternalThreadUpdate(sessionPath: string, timestamp = Date.now()) {
  recentInternalThreadUpdateAt.set(sessionPath, timestamp);
}

export function rememberLiveThread(sessionPath: string, thread: ThreadData) {
  liveThreads.set(sessionPath, thread);
}

export function getLiveThread(sessionPath: string) {
  return liveThreads.get(sessionPath) ?? null;
}

export function shouldSuppressExternalThreadUpdate(sessionPath: string, now = Date.now()) {
  if (liveThreads.get(sessionPath)?.isStreaming) {
    return true;
  }

  const lastInternalUpdateAt = recentInternalThreadUpdateAt.get(sessionPath);
  if (!lastInternalUpdateAt) {
    return false;
  }

  return now - lastInternalUpdateAt < EXTERNAL_UPDATE_SUPPRESSION_MS;
}
