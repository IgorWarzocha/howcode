import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  getSettingsBooleanValue,
  getSettingsComposerStreamingBehavior,
  getSettingsFavoriteFolders,
  getSettingsKey,
  getSettingsModelSelection,
  getSettingsPreferredProjectLocation,
  getSettingsProjectDeletionMode,
  getSettingsProjectImportState,
  getSettingsReset,
} from "../../shared/pi-thread-action-payloads.ts";
import {
  setComposerStreamingBehavior,
  setFavoriteFolders,
  setGitCommitMessageModelSelection,
  setInitializeGitOnProjectCreate,
  setPiTuiTakeover,
  setPreferredProjectLocation,
  setProjectDeletionMode,
  setProjectImportState,
  setSkillCreatorModelSelection,
  setUseAgentsSkillsPaths,
} from "../app-settings.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

export function handleSettingsDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): ActionHandlerResult {
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

  if (key === "projectDeletionMode") {
    const value = getSettingsProjectDeletionMode(payload);
    if (value) {
      setProjectDeletionMode(value);
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
