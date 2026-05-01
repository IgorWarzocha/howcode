import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { type SessionPathEntry, buildThreadHistorySlice } from "../../shared/thread-history.ts";
import {
  buildThreadData,
  setThreadCompactingState,
  setThreadStreamingState,
} from "../../shared/thread-data.ts";
import { buildComposerState } from "../runtime/composer-state.cts";
import type { PiRuntime, RuntimeThreadReason } from "../runtime/types.cts";
import { isChatSessionPath } from "../chat-state-db.cts";
import { emitDesktopEvent } from "./host-events.cts";
import { getLiveToolProgressMessages } from "./live-tool-progress.cts";

const LIVE_THREAD_UPDATE_THROTTLE_MS = 50;
const liveThreadUpdateTimers = new WeakMap<PiRuntime, ReturnType<typeof setTimeout>>();

function normalizeThreadDataForReason(
  thread: ReturnType<typeof buildThreadData>,
  reason: RuntimeThreadReason,
) {
  if (reason === "compaction-start") return setThreadCompactingState(thread, true);
  if (reason !== "end" && reason !== "compaction") return thread;
  return setThreadCompactingState(setThreadStreamingState(thread, false), false);
}

function buildLiveThreadData(runtime: PiRuntime) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) return null;
  const streamingMessage = runtime.session.state.streamingMessage;
  const historySlice = buildThreadHistorySlice(
    [...(runtime.session.sessionManager.getBranch() as SessionPathEntry[])],
    0,
  );
  const sourceMessages = [
    ...historySlice.sourceMessages,
    ...(streamingMessage ? [streamingMessage] : []),
    ...getLiveToolProgressMessages(runtime),
  ] as AgentMessage[];
  return buildThreadData({
    sessionPath,
    sourceMessages,
    previousMessageCount: historySlice.previousMessageCount,
    isStreaming: runtime.session.isStreaming,
    isCompacting: runtime.session.isCompacting,
  });
}

export async function publishThreadUpdate(runtime: PiRuntime, reason: RuntimeThreadReason) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) return;
  const liveThread = buildLiveThreadData(runtime);
  if (!liveThread) return;
  emitDesktopEvent({ type: "internal-thread-update", sessionPath });
  emitDesktopEvent({
    type: "thread-update",
    reason,
    projectId: runtime.cwd,
    threadId: runtime.session.sessionId,
    sessionPath,
    chatGroupId: runtime.chatGroupId ?? null,
    isChat: isChatSessionPath(sessionPath),
    thread: normalizeThreadDataForReason(liveThread, reason),
    composer: await buildComposerState(runtime, { includeContextUsage: reason !== "update" }),
  });
}

export function publishComposerUpdate(
  composer: Awaited<ReturnType<typeof buildComposerState>>,
  context: { projectId?: string | null; sessionPath?: string | null } = {},
) {
  emitDesktopEvent({
    type: "composer-update",
    composer,
    projectId: context.projectId ?? null,
    sessionPath: context.sessionPath ?? null,
  });
}

export function cancelLiveThreadUpdate(runtime: PiRuntime) {
  const timer = liveThreadUpdateTimers.get(runtime);
  if (!timer) return;
  clearTimeout(timer);
  liveThreadUpdateTimers.delete(runtime);
}

export function deferLiveThreadUpdate(
  runtime: PiRuntime,
  options: { requireStreaming?: boolean } = {},
) {
  cancelLiveThreadUpdate(runtime);
  const timer = setTimeout(() => {
    liveThreadUpdateTimers.delete(runtime);
    if (options.requireStreaming !== false && !runtime.session.isStreaming) return;
    void publishThreadUpdate(runtime, "update");
  }, 0);
  liveThreadUpdateTimers.set(runtime, timer);
}

export function scheduleLiveThreadUpdate(runtime: PiRuntime) {
  if (liveThreadUpdateTimers.has(runtime)) return;
  const timer = setTimeout(() => {
    liveThreadUpdateTimers.delete(runtime);
    if (!runtime.session.isStreaming) return;
    void publishThreadUpdate(runtime, "update");
  }, LIVE_THREAD_UPDATE_THROTTLE_MS);
  liveThreadUpdateTimers.set(runtime, timer);
}
