import { stat } from "node:fs/promises";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ComposerState, ProseMessage, ThreadData } from "../../shared/desktop-contracts.ts";
import { type SessionPathEntry, buildThreadHistorySlice } from "../../shared/thread-history.ts";
import { getLatestInboxAssistantMessage } from "../../shared/thread-inbox.ts";
import {
  buildThreadData,
  setThreadCompactingState,
  setThreadStreamingState,
} from "../../shared/thread-data.ts";
import { isChatSessionPath, upsertChatThread } from "../chat-state-db.cts";
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

type RuntimeToolProgress = {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  partialResult?: { content?: unknown };
  isError?: boolean;
  terminal?: boolean;
};

const liveToolProgressByRuntime = new WeakMap<PiRuntime, Map<string, RuntimeToolProgress>>();

function getLiveToolProgress(runtime: PiRuntime) {
  let progress = liveToolProgressByRuntime.get(runtime);
  if (!progress) {
    progress = new Map();
    liveToolProgressByRuntime.set(runtime, progress);
  }

  return progress;
}

function getLiveToolProgressMessages(runtime: PiRuntime) {
  const progress = liveToolProgressByRuntime.get(runtime);
  if (!progress || progress.size === 0) {
    return [] as AgentMessage[];
  }

  return [...progress.values()].map((entry) => {
    const content = entry.partialResult?.content;
    const displayContent = hasDisplayableToolContent(content)
      ? content
      : [
          {
            type: "text",
            text: entry.terminal
              ? entry.isError
                ? `${entry.toolName} failed.`
                : `${entry.toolName} finished.`
              : `Running ${entry.toolName}...`,
          },
        ];

    return {
      role: "toolResult",
      toolName: entry.toolName,
      isError: Boolean(entry.isError),
      content: displayContent,
      timestamp: `tool-progress:${entry.toolCallId}`,
    } as unknown as AgentMessage;
  });
}

function hasDisplayableToolContent(content: unknown): content is string | unknown[] {
  if (typeof content === "string") {
    return content.trim().length > 0;
  }

  if (!Array.isArray(content)) {
    return false;
  }

  return content.some((part) => {
    if (typeof part === "string") {
      return part.trim().length > 0;
    }

    if (!part || typeof part !== "object") {
      return false;
    }

    const record = part as Record<string, unknown>;
    if (record.type === "image") {
      return true;
    }

    return typeof record.text === "string" && record.text.trim().length > 0;
  });
}

export function rememberRuntimeToolProgress(runtime: PiRuntime, entry: RuntimeToolProgress) {
  getLiveToolProgress(runtime).set(entry.toolCallId, entry);
}

export function clearRuntimeToolProgress(
  runtime: PiRuntime,
  options: { toolCallId?: string; toolName?: string } = {},
) {
  const progress = liveToolProgressByRuntime.get(runtime);
  if (!progress) {
    return;
  }

  if (options.toolCallId) {
    progress.delete(options.toolCallId);
  } else if (!options.toolName) {
    progress.clear();
  } else {
    for (const [toolCallId, entry] of progress) {
      if (entry.toolName === options.toolName) {
        progress.delete(toolCallId);
        break;
      }
    }
  }

  if (progress.size === 0) {
    liveToolProgressByRuntime.delete(runtime);
  }
}

function buildLiveThreadData(runtime: PiRuntime) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    return null;
  }

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

function hasAssistantMessageChanged(
  sessionPath: string,
  latestAssistantMessage: ReturnType<typeof getLatestInboxAssistantMessage>,
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
  let latestUserMessage: ProseMessage | undefined;
  for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
    const message = thread.messages[index];
    if (message?.role === "user") {
      latestUserMessage = message as ProseMessage;
      break;
    }
  }

  if (!latestUserMessage) {
    return null;
  }

  const prompt = latestUserMessage.content.join("\n\n").trim();
  return prompt.length > 0 ? prompt : null;
}

export function normalizeThreadDataForReason(
  thread: ThreadData,
  reason: RuntimeThreadReason | "external",
): ThreadData {
  if (reason === "compaction-start") {
    return setThreadCompactingState(thread, true);
  }

  if (reason !== "end" && reason !== "external" && reason !== "compaction") {
    return thread;
  }

  return setThreadCompactingState(setThreadStreamingState(thread, false), false);
}

export async function publishThreadUpdate(runtime: PiRuntime, reason: RuntimeThreadReason) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    return;
  }

  markInternalThreadUpdate(sessionPath);

  const liveThread = buildLiveThreadData(runtime);
  if (!liveThread) {
    return;
  }

  const thread = normalizeThreadDataForReason(liveThread, reason);

  let threadId = runtime.session.sessionId;
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
    threadId = upsertThreadSummary({
      id: threadId,
      cwd: projectId,
      sessionPath,
      title: thread.title,
      lastModifiedMs: timestamp,
    });
    if (isChatSessionPath(sessionPath)) {
      upsertChatThread({ sessionPath, groupId: runtime.chatGroupId ?? null });
    }

    setThreadRunningState(
      sessionPath,
      reason === "update" ||
        reason === "compaction-start" ||
        (reason === "start" && thread.messages.length > 0),
    );

    if (reason === "start") {
      const latestUserPrompt = getLatestUserPrompt(thread);
      if (latestUserPrompt || hasInboxItem(sessionPath)) {
        beginInboxThreadTurn(sessionPath, latestUserPrompt);
      }
    }

    if (reason === "end") {
      const latestUserPrompt = getLatestUserPrompt(thread);
      const latestAssistantMessage = getLatestInboxAssistantMessage(thread.messages);
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
    chatGroupId: runtime.chatGroupId ?? null,
    isChat: isChatSessionPath(sessionPath),
    thread,
    composer: await buildComposerState(runtime, { includeContextUsage: reason !== "update" }),
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
  thread = normalizeThreadDataForReason(thread, "external");

  rememberLiveThread(sessionPath, thread);
  rememberSessionPath(sessionPath, projectId);
  threadId = upsertThreadSummary({
    id: threadId,
    cwd: projectId,
    sessionPath,
    title: thread.title,
    lastModifiedMs,
  });
  setThreadRunningState(sessionPath, false);

  const latestUserPrompt = getLatestUserPrompt(thread);
  const latestAssistantMessage = getLatestInboxAssistantMessage(thread.messages);

  if (!latestAssistantMessage && (latestUserPrompt || hasInboxItem(sessionPath))) {
    beginInboxThreadTurn(sessionPath, latestUserPrompt);
  }

  if (latestAssistantMessage && hasAssistantMessageChanged(sessionPath, latestAssistantMessage)) {
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
