import { stat } from "node:fs/promises";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ComposerState, DesktopEvent, ThreadData } from "../../shared/desktop-contracts.js";
import {
  getFirstUserTurnTitle,
  getPreviousMessageCount,
  mapAgentMessagesToUiMessages,
} from "../../shared/pi-message-mapper.js";
import { saveThreadCache, upsertThreadSummary } from "../thread-state-db.cjs";
import { buildComposerState } from "./composer-state.cjs";
import { rememberSessionPath } from "./session-path-index.cjs";
import type { PiRuntime, RuntimeThreadReason } from "./types.cjs";

const liveThreads = new Map<string, ThreadData>();
const desktopListeners = new Set<(event: DesktopEvent) => void>();

function emitDesktopEvent(event: DesktopEvent) {
  for (const listener of desktopListeners) {
    listener(event);
  }
}

function buildLiveThreadData(runtime: PiRuntime): ThreadData | null {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    return null;
  }

  const streamMessage = runtime.session.state.streamMessage;
  const sourceMessages = [...runtime.session.messages, ...(streamMessage ? [streamMessage] : [])];
  const messages = mapAgentMessagesToUiMessages(sourceMessages as AgentMessage[]);
  const previousMessageCount = getPreviousMessageCount(runtime.session.sessionManager.getBranch());

  return {
    sessionPath,
    title: getFirstUserTurnTitle(messages),
    messages,
    previousMessageCount,
    isStreaming: runtime.session.isStreaming,
  };
}

export async function publishThreadUpdate(runtime: PiRuntime, reason: RuntimeThreadReason) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    return;
  }

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

  liveThreads.set(sessionPath, thread);
  rememberSessionPath(sessionPath, projectId);

  if (hasPersistedSessionFile) {
    upsertThreadSummary({
      id: threadId,
      cwd: projectId,
      sessionPath,
      title: thread.title,
      lastModifiedMs: timestamp,
    });
    saveThreadCache(sessionPath, thread.title, thread.messages, timestamp);
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

export function subscribeDesktopEvents(listener: (event: DesktopEvent) => void) {
  desktopListeners.add(listener);

  return () => {
    desktopListeners.delete(listener);
  };
}

export function getLiveThread(sessionPath: string) {
  return liveThreads.get(sessionPath) ?? null;
}

export function publishComposerUpdate(composer: ComposerState) {
  emitDesktopEvent({ type: "composer-update", composer });
}
