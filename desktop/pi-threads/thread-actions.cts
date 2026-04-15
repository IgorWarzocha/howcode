import { unlink } from "node:fs/promises";
import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  getComposerRequest,
  getSessionPath,
  getThreadId,
  getThreadIds,
} from "../../shared/pi-thread-action-payloads.ts";
import { openThreadRuntime, startNewThread } from "../pi-desktop-runtime.cts";
import {
  archiveThread,
  archiveThreads,
  deleteThreadRecord,
  dismissInboxThread,
  getThreadSessionPath,
  markInboxThreadRead,
  restoreThread,
  toggleThreadPinned,
} from "../thread-state-db.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

async function deletePersistedThread(threadId: string) {
  const sessionPath = getThreadSessionPath(threadId);
  if (sessionPath) {
    try {
      await unlink(sessionPath);
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  deleteThreadRecord(threadId);
}

export async function handleThreadDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  switch (action) {
    case "thread.pin": {
      const threadId = getThreadId(payload);
      if (threadId) {
        toggleThreadPinned(threadId);
      }
      return handledAction();
    }

    case "thread.open": {
      const sessionPath = getSessionPath(payload);
      await openThreadRuntime(getComposerRequest(payload));
      if (sessionPath) {
        markInboxThreadRead(sessionPath);
      }
      return handledAction();
    }

    case "thread.archive": {
      const threadId = getThreadId(payload);
      if (threadId) {
        archiveThread(threadId);
      }
      return handledAction();
    }

    case "thread.archive-many": {
      const threadIds = getThreadIds(payload);
      if (threadIds.length > 0) {
        archiveThreads(threadIds);
      }
      return handledAction();
    }

    case "thread.restore": {
      const threadId = getThreadId(payload);
      if (threadId) {
        restoreThread(threadId);
      }
      return handledAction();
    }

    case "thread.delete": {
      const threadId = getThreadId(payload);
      if (threadId) {
        await deletePersistedThread(threadId);
      }
      return handledAction();
    }

    case "thread.new":
      return handledAction(await startNewThread(getComposerRequest(payload)));

    case "inbox.mark-read": {
      const sessionPath = getSessionPath(payload);
      if (sessionPath) {
        markInboxThreadRead(sessionPath);
      }
      return handledAction();
    }

    case "inbox.dismiss": {
      const sessionPath = getSessionPath(payload);
      if (sessionPath) {
        dismissInboxThread(sessionPath);
      }
      return handledAction();
    }

    default:
      return unhandledAction();
  }
}
