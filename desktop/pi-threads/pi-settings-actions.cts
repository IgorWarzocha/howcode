import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import { updatePiSetting, type PiSettingsKey } from "../pi-settings.cts";
import {
  handledAction,
  type ActionHandlerResult,
  unhandledAction,
} from "./action-router-result.cts";

const piSettingsKeys = new Set<PiSettingsKey>([
  "autoCompact",
  "enableSkillCommands",
  "hideThinkingBlock",
  "quietStartup",
  "showImages",
  "autoResizeImages",
  "blockImages",
  "collapseChangelog",
  "enableInstallTelemetry",
  "showHardwareCursor",
  "clearOnShrink",
  "transport",
  "steeringMode",
  "followUpMode",
  "doubleEscapeAction",
  "treeFilterMode",
  "editorPaddingX",
  "autocompleteMaxVisible",
  "imageWidthCells",
]);

function getPiSettingsKey(payload: AnyDesktopActionPayload): PiSettingsKey | null {
  return typeof payload.piSettingsKey === "string" &&
    piSettingsKeys.has(payload.piSettingsKey as PiSettingsKey)
    ? (payload.piSettingsKey as PiSettingsKey)
    : null;
}

export async function handlePiSettingsDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  if (action !== "pi-settings.update") {
    return unhandledAction();
  }

  const key = getPiSettingsKey(payload);
  if (!key) {
    return handledAction();
  }

  const piSettings = await updatePiSetting(key, payload.value);
  return handledAction({ piSettings });
}
