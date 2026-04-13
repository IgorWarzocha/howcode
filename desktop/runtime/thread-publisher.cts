import { stat } from "node:fs/promises";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ComposerState, ThreadData } from "../../shared/desktop-contracts.ts";
import { getPreviousMessageCount } from "../../shared/pi-message-mapper.ts";
import { buildThreadData } from "../../shared/thread-data.ts";
import { getTurnDiffSummaries } from "../diff/query.cts";
import {
  beginInboxThreadTurn,
  getThreadAssistantSnapshot,
  hasInboxItem,
  setThreadRunningState,
  upsertInboxThreadMessage,
  upsertThreadSummary,
} from "../thread-state-db.cts";
import { buildComposerState } from "./composer-state.cts";
import { emitDesktopEvent, subscribeDesktopEvents } from "./desktop-events.cts";
import {
  getLiveThread,
  markInternalThreadUpdate,
  rememberLiveThread,
  shouldSuppressExternalThreadUpdate,
} from "./live-thread-store.cts";
import { rememberSessionPath } from "./session-path-index.cts";
import type { PiRuntime, RuntimeThreadReason } from "./types.cts";

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

function getLatestAssistantMessage(thread: ThreadData) {
  const latestAssistantMessage = [...thread.messages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!latestAssistantMessage || latestAssistantMessage.role !== "assistant") {
    return null;
  }

  const content =
    latestAssistantMessage.content.length > 0
      ? latestAssistantMessage.content
      : (latestAssistantMessage.thinkingContent ?? []);

  if (content.length === 0) {
    return null;
  }

  return {
    content,
    preview:
      latestAssistantMessage.content[0] ??
      latestAssistantMessage.thinkingHeaders?.[0] ??
      latestAssistantMessage.thinkingContent?.[0] ??
      null,
  };
}

function hasAssistantMessageChanged(
  sessionPath: string,
  latestAssistantMessage: ReturnType<typeof getLatestAssistantMessage>,
) {
  if (!latestAssistantMessage) {
    return false;
  }

  const storedAssistantSnapshot = getThreadAssistantSnapshot(sessionPath);
  if (!storedAssistantSnapshot) {
    return true;
  }

  return (
    storedAssistantSnapshot.messageJson !== JSON.stringify(latestAssistantMessage.content) ||
    storedAssistantSnapshot.preview !== latestAssistantMessage.preview
  );
}

function getLatestUserPrompt(thread: ThreadData) {
  const latestUserMessage = [...thread.messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage || latestUserMessage.role !== "user") {
    return null;
  }

  const prompt = latestUserMessage.content.join("\n\n").trim();
  return prompt.length > 0 ? prompt : null;
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

    setThreadRunningState(
      sessionPath,
      reason === "update" || (reason === "start" && thread.messages.length > 0),
    );

    if (reason === "start") {
      const latestUserPrompt = getLatestUserPrompt(thread);
      if (latestUserPrompt || hasInboxItem(sessionPath)) {
        beginInboxThreadTurn(sessionPath, latestUserPrompt);
      }
    }

    if (reason === "end") {
      const latestUserPrompt = getLatestUserPrompt(thread);
      const latestAssistantMessage = getLatestAssistantMessage(thread);
      if (latestAssistantMessage) {
        upsertInboxThreadMessage({
          sessionPath,
          userPrompt: latestUserPrompt,
          content: latestAssistantMessage.content,
          preview: latestAssistantMessage.preview,
          lastAssistantAtMs: timestamp,
        });
      }
    }
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
  setThreadRunningState(sessionPath, false);

  const latestAssistantMessage = getLatestAssistantMessage(thread);
  if (latestAssistantMessage && hasAssistantMessageChanged(sessionPath, latestAssistantMessage)) {
    const latestUserPrompt = getLatestUserPrompt(thread);
    upsertInboxThreadMessage({
      sessionPath,
      userPrompt: latestUserPrompt,
      content: latestAssistantMessage.content,
      preview: latestAssistantMessage.preview,
      lastAssistantAtMs: lastModifiedMs,
    });
  }

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

export function publishComposerUpdate(
  composer: ComposerState,
  context: { projectId?: string | null; sessionPath?: string | null } = {},
) {
  emitDesktopEvent({
    type: "composer-update",
    composer,
    projectId: context.projectId ?? null,
    sessionPath: context.sessionPath ?? null,
  });
}

export { getLiveThread, shouldSuppressExternalThreadUpdate, subscribeDesktopEvents };
