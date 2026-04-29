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
import { subscribeRuntimeHostEvents, invokeRuntimeHost } from "./runtime-host/client.cts";
import { subscribeDesktopEvents as subscribeLocalDesktopEvents } from "./runtime/desktop-events.cts";

export { getLiveThread };

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

    void (async () => {
      markInternalThreadUpdate(event.sessionPath);
      rememberLiveThread(event.sessionPath, event.thread);
      await persistHostThreadUpdate(event);
      listener({ ...event });
    })();
  });

  return () => {
    unsubscribeLocal();
    unsubscribeHost();
  };
}

export function startNewThread(request: ComposerStateRequest = {}) {
  return invokeRuntimeHost("startNewThread", { request });
}

export function selectProjectRuntime(request: ComposerStateRequest = {}) {
  return invokeRuntimeHost("selectProjectRuntime", { request });
}

export function openThreadRuntime(request: ComposerStateRequest) {
  return invokeRuntimeHost("openThreadRuntime", { request });
}

export function getComposerSlashCommands(request: ComposerStateRequest = {}) {
  return invokeRuntimeHost("getComposerSlashCommands", { request });
}

export function getComposerState(request = {}) {
  return invokeRuntimeHost("getComposerState", { request });
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
  return invokeRuntimeHost("sendComposerPrompt", request);
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
  return invokeRuntimeHost("dequeueComposerPrompt", request);
}
