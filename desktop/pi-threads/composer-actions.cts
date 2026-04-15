import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  getComposerAttachments,
  getComposerModelSelection,
  getComposerQueueIndex,
  getComposerQueueMode,
  getComposerRequest,
  getComposerStreamingBehavior,
  getComposerText,
  getComposerThinkingLevel,
} from "../../shared/pi-thread-action-payloads.ts";
import {
  dequeueComposerPrompt,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  stopComposerRun,
} from "../pi-desktop-runtime.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

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
      if (!text) {
        return handledAction();
      }

      const composerSendOutcome = await sendComposerPrompt({
        ...getComposerRequest(payload),
        text,
        attachments: getComposerAttachments(payload),
        streamingBehavior: getComposerStreamingBehavior(payload),
      });
      return handledAction({ composerSendOutcome });
    }

    case "composer.stop": {
      await stopComposerRun(getComposerRequest(payload));
      return handledAction();
    }

    case "composer.dequeue": {
      const queueMode = getComposerQueueMode(payload);
      const queueIndex = getComposerQueueIndex(payload);

      if (!queueMode || queueIndex === null) {
        return handledAction();
      }

      const dequeuedText = await dequeueComposerPrompt({
        ...getComposerRequest(payload),
        queueMode,
        queueIndex,
      });

      return handledAction({ dequeuedText });
    }

    default:
      return unhandledAction();
  }
}
