import type { ThreadData } from "./desktop-contracts";

export function getEffectiveThreadRunningState(
  persistedRunning: boolean | number,
  liveThread: Pick<ThreadData, "isStreaming"> | null,
) {
  if (liveThread) {
    return liveThread.isStreaming;
  }

  return Boolean(persistedRunning);
}
