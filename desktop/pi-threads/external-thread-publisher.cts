import type { ProseMessage, ThreadData } from "../../shared/desktop-contracts.ts";
import { getLatestInboxAssistantMessage } from "../../shared/thread-inbox.ts";
import { setThreadCompactingState, setThreadStreamingState } from "../../shared/thread-data.ts";
import { emitDesktopEvent } from "../runtime/desktop-events.cts";
import {
  rememberLiveThread,
  shouldSuppressExternalThreadUpdate,
} from "../runtime/live-thread-store.cts";
import { rememberSessionPath } from "../runtime/session-path-index.cts";
import {
  beginInboxThreadTurn,
  getThreadAssistantSnapshot,
  hasInboxItem,
  setThreadRunningState,
  upsertInboxThreadMessage,
  upsertThreadSummary,
} from "../thread-state-db.cts";

function hasAssistantMessageChanged(
  sessionPath: string,
  latestAssistantMessage: ReturnType<typeof getLatestInboxAssistantMessage>,
) {
  if (!latestAssistantMessage) return false;
  const storedAssistantSnapshot = getThreadAssistantSnapshot(sessionPath);
  if (!storedAssistantSnapshot) return true;
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
  if (!latestUserMessage) return null;
  const prompt = latestUserMessage.content.join("\n\n").trim();
  return prompt.length > 0 ? prompt : null;
}

function normalizeExternalThreadData(thread: ThreadData) {
  return setThreadCompactingState(setThreadStreamingState(thread, false), false);
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
  thread = normalizeExternalThreadData(thread);
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

export { shouldSuppressExternalThreadUpdate };
