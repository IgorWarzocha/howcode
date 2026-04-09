import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { DesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  getComposerAttachments,
  getComposerModelSelection,
  getComposerRequest,
  getComposerText,
  getComposerThinkingLevel,
} from "../../shared/pi-thread-action-payloads.ts";
import {
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
} from "../pi-desktop-runtime.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

export async function handleComposerDesktopAction(
  action: DesktopAction,
  payload: DesktopActionPayload,
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

      await sendComposerPrompt({
        ...getComposerRequest(payload),
        text,
        attachments: getComposerAttachments(payload),
      });
      return handledAction();
    }

    default:
      return unhandledAction();
  }
}
