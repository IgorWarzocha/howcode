import type { PiSettings } from "../shared/desktop-contracts.ts";
import { defaultPiSettings } from "../shared/default-pi-settings.ts";
import { getDesktopWorkingDirectory } from "../shared/desktop-working-directory.ts";
import { getPiModule } from "./pi-module.cts";
import { markRuntimeSettingsStaleForProject } from "./runtime/runtime-registry.cts";

type PiSettingsManager = Awaited<ReturnType<typeof getPiSettingsManager>>;

export type PiSettingsKey = keyof PiSettings;

async function getPiSettingsManager(projectPath?: string | null) {
  const { SettingsManager, getAgentDir } = await getPiModule();
  return SettingsManager.create(projectPath ?? getDesktopWorkingDirectory(), getAgentDir());
}

export async function loadPiSettings(projectPath?: string | null): Promise<PiSettings> {
  const settingsManager = await getPiSettingsManager(projectPath);
  return {
    autoCompact: settingsManager.getCompactionEnabled(),
    enableSkillCommands: settingsManager.getEnableSkillCommands(),
    hideThinkingBlock: settingsManager.getHideThinkingBlock(),
    quietStartup: settingsManager.getQuietStartup(),
    showImages: settingsManager.getShowImages(),
    autoResizeImages: settingsManager.getImageAutoResize(),
    blockImages: settingsManager.getBlockImages(),
    collapseChangelog: settingsManager.getCollapseChangelog(),
    enableInstallTelemetry: settingsManager.getEnableInstallTelemetry(),
    showHardwareCursor: settingsManager.getShowHardwareCursor(),
    clearOnShrink: settingsManager.getClearOnShrink(),
    transport: asPiTransport(settingsManager.getTransport()) ?? defaultPiSettings.transport,
    steeringMode:
      asPiQueueMode(settingsManager.getSteeringMode()) ?? defaultPiSettings.steeringMode,
    followUpMode:
      asPiQueueMode(settingsManager.getFollowUpMode()) ?? defaultPiSettings.followUpMode,
    doubleEscapeAction:
      asPiDoubleEscapeAction(settingsManager.getDoubleEscapeAction()) ??
      defaultPiSettings.doubleEscapeAction,
    treeFilterMode:
      asPiTreeFilterMode(settingsManager.getTreeFilterMode()) ?? defaultPiSettings.treeFilterMode,
    editorPaddingX: settingsManager.getEditorPaddingX(),
    autocompleteMaxVisible: settingsManager.getAutocompleteMaxVisible(),
    imageWidthCells: settingsManager.getImageWidthCells(),
  };
}

function asPiTransport(value: unknown): PiSettings["transport"] | null {
  return value === "sse" || value === "websocket" || value === "auto" ? value : null;
}

function asPiQueueMode(value: unknown): PiSettings["steeringMode"] | null {
  return value === "all" || value === "one-at-a-time" ? value : null;
}

function asPiDoubleEscapeAction(value: unknown): PiSettings["doubleEscapeAction"] | null {
  return value === "fork" || value === "tree" || value === "none" ? value : null;
}

function asPiTreeFilterMode(value: unknown): PiSettings["treeFilterMode"] | null {
  return value === "default" ||
    value === "no-tools" ||
    value === "user-only" ||
    value === "labeled-only" ||
    value === "all"
    ? value
    : null;
}

function asBoundedInteger(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : null;
}

function updateBooleanSetting(
  settingsManager: PiSettingsManager,
  key: PiSettingsKey,
  value: unknown,
) {
  if (typeof value !== "boolean") {
    return false;
  }

  switch (key) {
    case "autoCompact":
      settingsManager.setCompactionEnabled(value);
      return true;
    case "enableSkillCommands":
      settingsManager.setEnableSkillCommands(value);
      return true;
    case "hideThinkingBlock":
      settingsManager.setHideThinkingBlock(value);
      return true;
    case "quietStartup":
      settingsManager.setQuietStartup(value);
      return true;
    case "showImages":
      settingsManager.setShowImages(value);
      return true;
    case "autoResizeImages":
      settingsManager.setImageAutoResize(value);
      return true;
    case "blockImages":
      settingsManager.setBlockImages(value);
      return true;
    case "collapseChangelog":
      settingsManager.setCollapseChangelog(value);
      return true;
    case "enableInstallTelemetry":
      settingsManager.setEnableInstallTelemetry(value);
      return true;
    case "showHardwareCursor":
      settingsManager.setShowHardwareCursor(value);
      return true;
    case "clearOnShrink":
      settingsManager.setClearOnShrink(value);
      return true;
    default:
      return false;
  }
}

export async function updatePiSetting(
  key: PiSettingsKey,
  value: unknown,
  projectPath?: string | null,
): Promise<PiSettings> {
  const settingsManager = await getPiSettingsManager(projectPath);
  let updated = updateBooleanSetting(settingsManager, key, value);

  if (!updated && key === "transport") {
    const transport = asPiTransport(value);
    if (transport) {
      settingsManager.setTransport(transport);
      updated = true;
    }
  }

  if (!updated && (key === "steeringMode" || key === "followUpMode")) {
    const mode = asPiQueueMode(value);
    if (mode) {
      if (key === "steeringMode") {
        settingsManager.setSteeringMode(mode);
      } else {
        settingsManager.setFollowUpMode(mode);
      }
      updated = true;
    }
  }

  if (!updated && key === "doubleEscapeAction") {
    const action = asPiDoubleEscapeAction(value);
    if (action) {
      settingsManager.setDoubleEscapeAction(action);
      updated = true;
    }
  }

  if (!updated && key === "treeFilterMode") {
    const mode = asPiTreeFilterMode(value);
    if (mode) {
      settingsManager.setTreeFilterMode(mode);
      updated = true;
    }
  }

  if (!updated && key === "editorPaddingX") {
    const padding = asBoundedInteger(value, 0, 3);
    if (padding !== null) {
      settingsManager.setEditorPaddingX(padding);
      updated = true;
    }
  }

  if (!updated && key === "autocompleteMaxVisible") {
    const maxVisible = asBoundedInteger(value, 3, 20);
    if (maxVisible !== null) {
      settingsManager.setAutocompleteMaxVisible(maxVisible);
      updated = true;
    }
  }

  if (!updated && key === "imageWidthCells") {
    const width = asBoundedInteger(value, 1, 200);
    if (width !== null) {
      settingsManager.setImageWidthCells(width);
      updated = true;
    }
  }

  if (updated) {
    await settingsManager.flush();
    await markRuntimeSettingsStaleForProject(null);
  }

  return loadPiSettings(projectPath);
}
