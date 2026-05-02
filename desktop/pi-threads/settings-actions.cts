import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  getSettingsBooleanValue,
  getSettingsComposerStreamingBehavior,
  getSettingsDictationModelId,
  getSettingsFavoriteFolders,
  getSettingsKey,
  getSettingsModelSelection,
  getSettingsNumberValue,
  getSettingsPreferredProjectLocation,
  getSettingsProjectDiffBaselineDefault,
  getSettingsProjectDiffRenderModeDefault,
  getSettingsProjectDeletionMode,
  getSettingsProjectImportState,
  getSettingsReset,
  getSettingsThinkingLevel,
} from "../../shared/pi-thread-action-payloads.ts";
import {
  setChatModelSelection,
  setChatThinkingLevel,
  setCodeModelSelection,
  setCodeThinkingLevel,
  setComposerStreamingBehavior,
  setDictationMaxDurationSeconds,
  setDictationModelId,
  setFavoriteFolders,
  setGitCommitMessageModelSelection,
  setGitCommitMessageThinkingLevel,
  setGitDiffBaselineDefault,
  setGitDiffFileTreeDefaultVisible,
  setGitDiffRenderModeDefault,
  setGitOpsDefaultMode,
  setInitializeGitOnProjectCreate,
  setPiTuiTakeover,
  setPreferredProjectLocation,
  setProjectDeletionMode,
  setProjectImportState,
  setShowDictationButton,
  setSkillCreatorModelSelection,
  setSkillCreatorThinkingLevel,
  setUseAgentsSkillsPaths,
} from "../app-settings/writers.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

const clipboardImageTempDir = path.join(tmpdir(), "howcode-clipboard-images");

async function clearClipboardImageTempFiles() {
  let entries: Array<{ isFile(): boolean; name: string }>;
  try {
    entries = await readdir(clipboardImageTempDir, { withFileTypes: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return { clearedCount: 0, clearFailedCount: 0 };
    }

    return { clearedCount: 0, clearFailedCount: 1 };
  }

  const targets = entries.filter(
    (entry) =>
      entry.isFile() && entry.name.startsWith("howcode-clipboard-") && entry.name.endsWith(".png"),
  );
  const results = await Promise.allSettled(
    targets.map((entry) => rm(path.join(clipboardImageTempDir, entry.name), { force: true })),
  );
  return {
    clearedCount: results.filter((result) => result.status === "fulfilled").length,
    clearFailedCount: results.filter((result) => result.status === "rejected").length,
  };
}

export async function handleSettingsDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  if (action === "settings.clear-clipboard-images") {
    return handledAction(await clearClipboardImageTempFiles());
  }

  if (action !== "settings.update") {
    return unhandledAction();
  }

  const key = getSettingsKey(payload);
  if (!key) {
    return handledAction();
  }

  if (key === "favoriteFolders") {
    setFavoriteFolders(getSettingsFavoriteFolders(payload));
    return handledAction();
  }

  if (key === "composerStreamingBehavior") {
    const value = getSettingsComposerStreamingBehavior(payload);
    if (value) {
      setComposerStreamingBehavior(value);
    }
    return handledAction();
  }

  if (key === "dictationModelId") {
    setDictationModelId(getSettingsDictationModelId(payload));
    return handledAction();
  }

  if (key === "dictationMaxDurationSeconds") {
    const value = getSettingsNumberValue(payload);
    if (value !== null) {
      setDictationMaxDurationSeconds(value);
    }
    return handledAction();
  }

  if (key === "showDictationButton") {
    setShowDictationButton(getSettingsBooleanValue(payload) ?? true);
    return handledAction();
  }

  if (key === "projectImportState") {
    setProjectImportState(getSettingsProjectImportState(payload));
    return handledAction();
  }

  if (key === "useAgentsSkillsPaths") {
    setUseAgentsSkillsPaths(getSettingsBooleanValue(payload) ?? false);
    return handledAction();
  }

  if (key === "piTuiTakeover") {
    setPiTuiTakeover(getSettingsBooleanValue(payload) ?? false);
    return handledAction();
  }

  if (key === "preferredProjectLocation") {
    setPreferredProjectLocation(getSettingsPreferredProjectLocation(payload));
    return handledAction();
  }

  if (key === "initializeGitOnProjectCreate") {
    const value = getSettingsBooleanValue(payload);
    if (value !== null) {
      setInitializeGitOnProjectCreate(value);
    }
    return handledAction();
  }

  if (key === "gitOpsDefaultMode") {
    const value = payload.value;
    if (value === "commit" || value === "commit-push") {
      setGitOpsDefaultMode(value);
    }
    return handledAction();
  }

  if (key === "gitDiffBaselineDefault") {
    const value = getSettingsProjectDiffBaselineDefault(payload);
    if (value) {
      setGitDiffBaselineDefault(value);
    }
    return handledAction();
  }

  if (key === "gitDiffFileTreeDefaultVisible") {
    const value = getSettingsBooleanValue(payload);
    if (value !== null) {
      setGitDiffFileTreeDefaultVisible(value);
    }
    return handledAction();
  }

  if (key === "gitDiffRenderModeDefault") {
    const value = getSettingsProjectDiffRenderModeDefault(payload);
    if (value) {
      setGitDiffRenderModeDefault(value);
    }
    return handledAction();
  }

  if (key === "projectDeletionMode") {
    const value = getSettingsProjectDeletionMode(payload);
    if (value) {
      setProjectDeletionMode(value);
    }
    return handledAction();
  }

  if (key === "chatModel") {
    if (getSettingsReset(payload)) {
      setChatModelSelection(null);
      return handledAction();
    }

    const selection = getSettingsModelSelection(payload);
    if (selection) {
      setChatModelSelection(selection);
    }
    return handledAction();
  }

  if (key === "codeModel") {
    if (getSettingsReset(payload)) {
      setCodeModelSelection(null);
      return handledAction();
    }

    const selection = getSettingsModelSelection(payload);
    if (selection) {
      setCodeModelSelection(selection);
    }
    return handledAction();
  }

  if (key === "chatThinkingLevel") {
    if (getSettingsReset(payload)) {
      setChatThinkingLevel(null);
      return handledAction();
    }

    const level = getSettingsThinkingLevel(payload);
    if (level) {
      setChatThinkingLevel(level);
    }
    return handledAction();
  }

  if (key === "codeThinkingLevel") {
    if (getSettingsReset(payload)) {
      setCodeThinkingLevel(null);
      return handledAction();
    }

    const level = getSettingsThinkingLevel(payload);
    if (level) {
      setCodeThinkingLevel(level);
    }
    return handledAction();
  }

  if (key === "skillCreatorModel") {
    if (getSettingsReset(payload)) {
      setSkillCreatorModelSelection(null);
      return handledAction();
    }

    const selection = getSettingsModelSelection(payload);
    if (selection) {
      setSkillCreatorModelSelection(selection);
    }
    return handledAction();
  }

  if (key === "gitCommitMessageThinkingLevel") {
    const level = getSettingsThinkingLevel(payload);
    if (level) {
      setGitCommitMessageThinkingLevel(level);
    }
    return handledAction();
  }

  if (key === "skillCreatorThinkingLevel") {
    const level = getSettingsThinkingLevel(payload);
    if (level) {
      setSkillCreatorThinkingLevel(level);
    }
    return handledAction();
  }

  if (getSettingsReset(payload)) {
    setGitCommitMessageModelSelection(null);
    return handledAction();
  }

  const selection = getSettingsModelSelection(payload);
  if (selection) {
    setGitCommitMessageModelSelection(selection);
  }

  return handledAction();
}
