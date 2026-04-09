import { unlink } from "node:fs/promises";
import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import { getComposerRequest, getThreadId } from "../../shared/pi-thread-action-payloads.ts";
import { openThreadRuntime, startNewThread } from "../pi-desktop-runtime.cts";
import {
  archiveThread,
  deleteThreadRecord,
  getThreadSessionPath,
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

    case "thread.open":
      await openThreadRuntime(getComposerRequest(payload));
      return handledAction();

    case "thread.archive": {
      const threadId = getThreadId(payload);
      if (threadId) {
        archiveThread(threadId);
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

    default:
      return unhandledAction();
  }
}
