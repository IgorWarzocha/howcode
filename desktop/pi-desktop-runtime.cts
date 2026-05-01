import { stat } from "node:fs/promises";
import type {
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  ProseMessage,
  ThreadData,
  DesktopEvent,
  ComposerAttachment,
} from "../shared/desktop-contracts.ts";
import { getLatestInboxAssistantMessage } from "../shared/thread-inbox.ts";
import {
  beginInboxThreadTurn,
  hasInboxItem,
  setThreadRunningState,
  upsertInboxThreadMessage,
  upsertThreadSummary,
} from "./thread-state-db.cts";
import {
  getLiveThread,
  markInternalThreadUpdate,
  rememberLiveThread,
} from "./runtime/live-thread-store.cts";
import { subscribeRuntimeHostEvents, invokeRuntimeHost } from "./runtime-host/client-bridge.cts";
import { subscribeDesktopEvents as subscribeLocalDesktopEvents } from "./runtime/desktop-events.cts";
import { loadAppSettings } from "./app-settings/readers.cts";
import { getChatSessionDir } from "./chat-session-dir.cts";
import { isChatSessionPath, upsertChatThread } from "./chat-state-db.cts";

export { getLiveThread };

function withComposerModeSettings<TRequest extends ComposerStateRequest>(
  request: TRequest,
): TRequest {
  const appSettings = loadAppSettings();
  const composerModelSelection =
    request.composerMode === "chat"
      ? appSettings.chatModel
      : request.composerMode === "code"
        ? appSettings.codeModel
        : null;
  const composerThinkingLevel =
    request.composerMode === "chat"
      ? appSettings.chatThinkingLevel
      : request.composerMode === "code"
        ? appSettings.codeThinkingLevel
        : null;

  return {
    ...request,
    composerModelSelection,
    composerUseDefaultModel: Boolean(request.composerMode) && composerModelSelection === null,
    composerThinkingLevel,
    composerStreamingBehavior: appSettings.composerStreamingBehavior,
    composerSessionDir: request.composerMode === "chat" ? getChatSessionDir() : null,
  };
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

async function persistHostThreadUpdate(event: Extract<DesktopEvent, { type: "thread-update" }>) {
  try {
    await stat(event.sessionPath);
  } catch {
    return;
  }
  const timestamp = Date.now();
  const threadId = upsertThreadSummary({
    id: event.threadId,
    cwd: event.projectId,
    sessionPath: event.sessionPath,
    title: event.thread.title,
    lastModifiedMs: timestamp,
  });

  event.threadId = threadId;
  if (isChatSessionPath(event.sessionPath)) {
    upsertChatThread({ sessionPath: event.sessionPath, groupId: event.chatGroupId ?? null });
  }
  setThreadRunningState(
    event.sessionPath,
    event.reason === "update" ||
      event.reason === "compaction-start" ||
      (event.reason === "start" && event.thread.messages.length > 0),
  );

  const latestUserPrompt = getLatestUserPrompt(event.thread);
  if (event.reason === "start" && (latestUserPrompt || hasInboxItem(event.sessionPath))) {
    beginInboxThreadTurn(event.sessionPath, latestUserPrompt);
  }

  if (event.reason === "end") {
    const latestAssistantMessage = getLatestInboxAssistantMessage(event.thread.messages);
    if (latestAssistantMessage) {
      upsertInboxThreadMessage({
        sessionPath: event.sessionPath,
        userPrompt: latestUserPrompt,
        content: latestAssistantMessage.content,
        preview: latestAssistantMessage.preview,
        lastAssistantAtMs: timestamp,
      });
    }
  }
}

const threadUpdateForwardingBySession = new Map<string, Promise<void>>();

function enqueueHostThreadUpdate(
  event: Extract<DesktopEvent, { type: "thread-update" }>,
  listener: (event: DesktopEvent) => void,
) {
  const sessionPath = event.sessionPath;
  const previous = threadUpdateForwardingBySession.get(sessionPath) ?? Promise.resolve();
  const next = previous
    .catch(() => {
      // Keep the per-session queue moving after an earlier failed update.
    })
    .then(async () => {
      markInternalThreadUpdate(sessionPath);
      rememberLiveThread(sessionPath, event.thread);
      try {
        await persistHostThreadUpdate(event);
      } catch (error) {
        console.warn(`Failed to persist Pi runtime host thread update: ${sessionPath}`, error);
      }
      listener({ ...event });
    })
    .catch((error) => {
      console.warn(`Failed to forward Pi runtime host thread update: ${sessionPath}`, error);
    })
    .finally(() => {
      if (threadUpdateForwardingBySession.get(sessionPath) === next) {
        threadUpdateForwardingBySession.delete(sessionPath);
      }
    });

  threadUpdateForwardingBySession.set(sessionPath, next);
}

export function subscribeDesktopEvents(listener: (event: DesktopEvent) => void) {
  const unsubscribeLocal = subscribeLocalDesktopEvents(listener);
  const unsubscribeHost = subscribeRuntimeHostEvents((event) => {
    if (event.type === "internal-thread-update") {
      markInternalThreadUpdate(event.sessionPath);
      return;
    }

    if (event.type !== "thread-update") {
      listener(event);
      return;
    }

    enqueueHostThreadUpdate(event, listener);
  });

  return () => {
    unsubscribeLocal();
    unsubscribeHost();
  };
}

export function startNewThread(request: ComposerStateRequest = {}) {
  return invokeRuntimeHost("startNewThread", { request: withComposerModeSettings(request) });
}

export function selectProjectRuntime(request: ComposerStateRequest = {}) {
  return invokeRuntimeHost("selectProjectRuntime", { request: withComposerModeSettings(request) });
}

export function openThreadRuntime(request: ComposerStateRequest) {
  return invokeRuntimeHost("openThreadRuntime", { request: withComposerModeSettings(request) });
}

export function getComposerSlashCommands(request: ComposerStateRequest = {}) {
  return invokeRuntimeHost("getComposerSlashCommands", {
    request: withComposerModeSettings(request),
  });
}

export function getComposerState(request = {}) {
  return invokeRuntimeHost("getComposerState", { request: withComposerModeSettings(request) });
}

export function setComposerModel(request: ComposerStateRequest, provider: string, modelId: string) {
  return invokeRuntimeHost("setComposerModel", { request, provider, modelId });
}

export function setComposerThinkingLevel(
  request: ComposerStateRequest,
  level: ComposerThinkingLevel,
) {
  return invokeRuntimeHost("setComposerThinkingLevel", { request, level });
}

export function sendComposerPrompt(
  request: ComposerStateRequest & {
    text: string;
    attachments?: ComposerAttachment[];
    streamingBehavior?: ComposerStreamingBehavior | null;
  },
) {
  return invokeRuntimeHost("sendComposerPrompt", withComposerModeSettings(request));
}

export function stopComposerRun(request = {}) {
  return invokeRuntimeHost("stopComposerRun", { request });
}

export function dequeueComposerPrompt(
  request: ComposerStateRequest & {
    queueId: string;
    queueSnapshotKey: string;
    queueMode: Exclude<ComposerStreamingBehavior, "stop">;
  },
) {
  return invokeRuntimeHost("dequeueComposerPrompt", withComposerModeSettings(request));
}
