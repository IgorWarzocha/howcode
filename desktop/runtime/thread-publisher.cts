import { stat } from "node:fs/promises";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ComposerState, ThreadData } from "../../shared/desktop-contracts";
import { getPreviousMessageCount } from "../../shared/pi-message-mapper";
import { buildThreadData } from "../../shared/thread-data";
import { getTurnDiffSummaries } from "../diff/query";
import { upsertThreadSummary } from "../thread-state-db";
import { buildComposerState } from "./composer-state";
import { emitDesktopEvent, subscribeDesktopEvents } from "./desktop-events";
import {
  getLiveThread,
  markInternalThreadUpdate,
  rememberLiveThread,
  shouldSuppressExternalThreadUpdate,
} from "./live-thread-store";
import { rememberSessionPath } from "./session-path-index";
import type { PiRuntime, RuntimeThreadReason } from "./types";

function buildLiveThreadData(runtime: PiRuntime) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    return null;
  }

  const streamMessage = runtime.session.state.streamMessage;
  const sourceMessages = [
    ...runtime.session.messages,
    ...(streamMessage ? [streamMessage] : []),
  ] as AgentMessage[];
  const previousMessageCount = getPreviousMessageCount(runtime.session.sessionManager.getBranch());

  return buildThreadData({
    sessionPath,
    sourceMessages,
    previousMessageCount,
    isStreaming: runtime.session.isStreaming,
    turnDiffSummaries: getTurnDiffSummaries(sessionPath),
  });
}

export async function publishThreadUpdate(runtime: PiRuntime, reason: RuntimeThreadReason) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    return;
  }

  markInternalThreadUpdate(sessionPath);

  const thread = buildLiveThreadData(runtime);
  if (!thread) {
    return;
  }

  const threadId = runtime.session.sessionId;
  const projectId = runtime.cwd;
  const timestamp = Date.now();
  let hasPersistedSessionFile = false;

  try {
    await stat(sessionPath);
    hasPersistedSessionFile = true;
  } catch {
    hasPersistedSessionFile = false;
  }

  rememberLiveThread(sessionPath, thread);
  rememberSessionPath(sessionPath, projectId);

  if (hasPersistedSessionFile) {
    upsertThreadSummary({
      id: threadId,
      cwd: projectId,
      sessionPath,
      title: thread.title,
      lastModifiedMs: timestamp,
    });
  }

  emitDesktopEvent({
    type: "thread-update",
    reason,
    projectId,
    threadId,
    sessionPath,
    thread,
    composer: await buildComposerState(runtime),
  });
}

export async function publishExternalThreadUpdate({
  lastModifiedMs,
  projectId,
  sessionPath,
  thread,
  threadId,
}: {
  lastModifiedMs: number;
  projectId: string;
  sessionPath: string;
  thread: ThreadData;
  threadId: string;
}) {
  rememberLiveThread(sessionPath, thread);
  rememberSessionPath(sessionPath, projectId);
  upsertThreadSummary({
    id: threadId,
    cwd: projectId,
    sessionPath,
    title: thread.title,
    lastModifiedMs,
  });

  emitDesktopEvent({
    type: "thread-update",
    reason: "external",
    projectId,
    threadId,
    sessionPath,
    thread,
    composer: null,
  });
}

export function publishComposerUpdate(composer: ComposerState) {
  emitDesktopEvent({ type: "composer-update", composer });
}

export { getLiveThread, shouldSuppressExternalThreadUpdate, subscribeDesktopEvents };
