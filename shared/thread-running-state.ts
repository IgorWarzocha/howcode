import type { InboxThread, ThreadData } from "./desktop-contracts";

export function getEffectiveThreadRunningState(
  persistedRunning: boolean | number,
  liveThread: Pick<ThreadData, "isStreaming"> | null,
) {
  if (liveThread) {
    return liveThread.isStreaming;
  }

  return Boolean(persistedRunning);
}

export function sortInboxThreadsByPriority(threads: InboxThread[]) {
  return [...threads].sort((left, right) => {
    if (left.unread !== right.unread) {
      return left.unread ? -1 : 1;
    }

    if (left.running !== right.running) {
      return left.running ? -1 : 1;
    }

    const leftActivity = left.lastActivityMs ?? 0;
    const rightActivity = right.lastActivityMs ?? 0;
    if (leftActivity !== rightActivity) {
      return rightActivity - leftActivity;
    }

    return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  });
}
