import { buildThreadData } from "../../shared/thread-data.ts";
import { type SessionPathEntry, buildThreadHistorySlice } from "../../shared/thread-history.ts";
import { getPiModule } from "../pi-module.cts";

export async function loadThreadSnapshot(request: {
  sessionPath: string;
  historyCompactions?: number;
}) {
  const { SessionManager } = await getPiModule();
  const manager = SessionManager.open(request.sessionPath);
  const historySlice = buildThreadHistorySlice(
    [...(manager.getBranch() as SessionPathEntry[])],
    request.historyCompactions ?? 0,
  );

  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    thread: buildThreadData({
      sessionPath: request.sessionPath,
      sourceMessages: historySlice.sourceMessages,
      previousMessageCount: historySlice.previousMessageCount,
      isStreaming: false,
      isCompacting: false,
    }),
  };
}
