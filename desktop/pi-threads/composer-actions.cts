import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  getComposerAttachments,
  getComposerModelSelection,
  getComposerQueueId,
  getComposerQueueMode,
  getComposerQueueSnapshotKey,
  getComposerRequest,
  getComposerStreamingBehavior,
  getComposerText,
  getComposerThinkingLevel,
} from "../../shared/pi-thread-action-payloads.ts";
import { markRuntimeSettingsStale } from "../runtime/runtime-registry.cts";
import {
  dequeueComposerPrompt,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  stopComposerRun,
} from "../pi-desktop-runtime.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";
import { normalizeComposerSendAttachments } from "./composer-attachment-payload";

export async function handleComposerDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  switch (action) {
    case "composer.model": {
      const selection = getComposerModelSelection(payload);
      if (selection) {
        await setComposerModel(getComposerRequest(payload), selection.provider, selection.modelId);
      }
      return handledAction();
    }

    case "composer.thinking": {
      const level = getComposerThinkingLevel(payload);
      if (level) {
        await setComposerThinkingLevel(getComposerRequest(payload), level);
      }
      return handledAction();
    }

    case "composer.send": {
      const text = getComposerText(payload);
      const rawAttachments = getComposerAttachments(payload);
      const normalizedAttachmentPayload = await normalizeComposerSendAttachments(rawAttachments);
      const attachments = normalizedAttachmentPayload.attachments;
      if (normalizedAttachmentPayload.rejected) {
        return handledAction({
          error:
            "Could not send prompt because one or more attached files are no longer available.",
        });
      }

      if (!text && attachments.length === 0) {
        return handledAction();
      }

      const composerSendOutcome = await sendComposerPrompt({
        ...getComposerRequest(payload),
        text,
        attachments,
        streamingBehavior: getComposerStreamingBehavior(payload),
      });
      return handledAction({ composerSendOutcome });
    }

    case "composer.stop": {
      await stopComposerRun(getComposerRequest(payload));
      return handledAction();
    }

    case "composer.dequeue": {
      const queueId = getComposerQueueId(payload);
      const queueMode = getComposerQueueMode(payload);
      const queueSnapshotKey = getComposerQueueSnapshotKey(payload);

      if (!queueId || !queueMode || !queueSnapshotKey) {
        return handledAction();
      }

      const dequeuedText = await dequeueComposerPrompt({
        ...getComposerRequest(payload),
        queueId,
        queueSnapshotKey,
        queueMode,
      });

      return handledAction({ dequeuedText });
    }

    case "composer.reload-settings": {
      await markRuntimeSettingsStale(getComposerRequest(payload).sessionPath);
      return handledAction();
    }

    default:
      return unhandledAction();
  }
}
