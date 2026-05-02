import type {
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DictationModelId,
  GitOpsMode,
  ModelSelection,
  ProjectDiffDefaultBaseline,
  ProjectDiffRenderMode,
  ProjectDeletionMode,
} from "../../shared/desktop-contracts.ts";
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  normalizeDictationMaxDurationSeconds,
} from "../../shared/dictation-settings.ts";
import { getThreadStateDatabase } from "../thread-state-db/db.cts";
import {
  chatModelKey,
  chatThinkingLevelKey,
  codeModelKey,
  codeThinkingLevelKey,
  composerStreamingBehaviorKey,
  dictationMaxDurationSecondsKey,
  dictationModelIdKey,
  favoriteFoldersKey,
  gitCommitMessageModelKey,
  gitCommitMessageThinkingLevelKey,
  gitDiffBaselineDefaultKey,
  gitDiffFileTreeDefaultVisibleKey,
  gitDiffRenderModeDefaultKey,
  gitOpsDefaultModeKey,
  initializeGitOnProjectCreateKey,
  piTuiTakeoverKey,
  preferredProjectLocationKey,
  projectDeletionModeKey,
  projectImportStateKey,
  showDictationButtonKey,
  skillCreatorModelKey,
  skillCreatorThinkingLevelKey,
  useAgentsSkillsPathsKey,
} from "./keys.cts";

function writeAppPreference(key: string, valueJson: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      INSERT INTO app_preferences (key, value_json)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(key, valueJson);
}

function deleteAppPreference(key: string) {
  const db = getThreadStateDatabase();
  db.prepare(
    `
      DELETE FROM app_preferences
      WHERE key = ?
    `,
  ).run(key);
}

export function setGitCommitMessageModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreference(gitCommitMessageModelKey);
    return;
  }

  writeAppPreference(gitCommitMessageModelKey, JSON.stringify(selection));
}

export function setChatModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreference(chatModelKey);
    return;
  }

  writeAppPreference(chatModelKey, JSON.stringify(selection));
}

export function setChatThinkingLevel(level: ComposerThinkingLevel | null) {
  if (!level) {
    deleteAppPreference(chatThinkingLevelKey);
    return;
  }

  writeAppPreference(chatThinkingLevelKey, JSON.stringify(level));
}

export function setCodeModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreference(codeModelKey);
    return;
  }

  writeAppPreference(codeModelKey, JSON.stringify(selection));
}

export function setCodeThinkingLevel(level: ComposerThinkingLevel | null) {
  if (!level) {
    deleteAppPreference(codeThinkingLevelKey);
    return;
  }

  writeAppPreference(codeThinkingLevelKey, JSON.stringify(level));
}

export function setGitCommitMessageThinkingLevel(level: ComposerThinkingLevel) {
  writeAppPreference(gitCommitMessageThinkingLevelKey, JSON.stringify(level));
}

export function setSkillCreatorModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreference(skillCreatorModelKey);
    return;
  }

  writeAppPreference(skillCreatorModelKey, JSON.stringify(selection));
}

export function setSkillCreatorThinkingLevel(level: ComposerThinkingLevel) {
  writeAppPreference(skillCreatorThinkingLevelKey, JSON.stringify(level));
}

export function setComposerStreamingBehavior(behavior: ComposerStreamingBehavior) {
  writeAppPreference(composerStreamingBehaviorKey, JSON.stringify(behavior));
}

export function setDictationModelId(modelId: DictationModelId | null) {
  if (!modelId) {
    deleteAppPreference(dictationModelIdKey);
    return;
  }

  writeAppPreference(dictationModelIdKey, JSON.stringify(modelId));
}

export function setDictationMaxDurationSeconds(value: number) {
  const normalizedValue = normalizeDictationMaxDurationSeconds(value);

  if (!normalizedValue || normalizedValue === DEFAULT_DICTATION_MAX_DURATION_SECONDS) {
    deleteAppPreference(dictationMaxDurationSecondsKey);
    return;
  }

  writeAppPreference(dictationMaxDurationSecondsKey, JSON.stringify(normalizedValue));
}

export function setShowDictationButton(enabled: boolean) {
  if (enabled) {
    deleteAppPreference(showDictationButtonKey);
    return;
  }

  writeAppPreference(showDictationButtonKey, JSON.stringify(false));
}

export function setFavoriteFolders(favoriteFolders: string[]) {
  const normalizedFavoriteFolderSet = new Set<string>();
  for (const folder of favoriteFolders) {
    const trimmedFolder = folder.trim();
    if (trimmedFolder) {
      normalizedFavoriteFolderSet.add(trimmedFolder);
    }
  }
  const normalizedFavoriteFolders = [...normalizedFavoriteFolderSet];

  if (normalizedFavoriteFolders.length === 0) {
    deleteAppPreference(favoriteFoldersKey);
    return;
  }

  writeAppPreference(favoriteFoldersKey, JSON.stringify(normalizedFavoriteFolders));
}

export function setProjectImportState(projectImportState: boolean | null) {
  if (projectImportState === null) {
    deleteAppPreference(projectImportStateKey);
    return;
  }

  writeAppPreference(projectImportStateKey, JSON.stringify(projectImportState));
}

export function setPreferredProjectLocation(preferredProjectLocation: string | null) {
  const normalizedLocation = preferredProjectLocation?.trim() ?? "";
  if (normalizedLocation.length === 0) {
    deleteAppPreference(preferredProjectLocationKey);
    return;
  }

  writeAppPreference(preferredProjectLocationKey, JSON.stringify(normalizedLocation));
}

export function setInitializeGitOnProjectCreate(enabled: boolean) {
  writeAppPreference(initializeGitOnProjectCreateKey, JSON.stringify(enabled));
}

export function setGitOpsDefaultMode(mode: GitOpsMode) {
  if (mode === "commit") {
    deleteAppPreference(gitOpsDefaultModeKey);
    return;
  }

  writeAppPreference(gitOpsDefaultModeKey, JSON.stringify(mode));
}

export function setGitDiffBaselineDefault(baseline: ProjectDiffDefaultBaseline) {
  if (baseline.kind === "head") {
    deleteAppPreference(gitDiffBaselineDefaultKey);
    return;
  }

  writeAppPreference(gitDiffBaselineDefaultKey, JSON.stringify(baseline));
}

export function setGitDiffRenderModeDefault(mode: ProjectDiffRenderMode) {
  if (mode === "stacked") {
    deleteAppPreference(gitDiffRenderModeDefaultKey);
    return;
  }

  writeAppPreference(gitDiffRenderModeDefaultKey, JSON.stringify(mode));
}

export function setGitDiffFileTreeDefaultVisible(visible: boolean) {
  if (visible) {
    deleteAppPreference(gitDiffFileTreeDefaultVisibleKey);
    return;
  }

  writeAppPreference(gitDiffFileTreeDefaultVisibleKey, JSON.stringify(false));
}

export function setProjectDeletionMode(mode: ProjectDeletionMode) {
  writeAppPreference(projectDeletionModeKey, JSON.stringify(mode));
}

export function setUseAgentsSkillsPaths(enabled: boolean) {
  writeAppPreference(useAgentsSkillsPathsKey, JSON.stringify(enabled));
}

export function setPiTuiTakeover(enabled: boolean) {
  writeAppPreference(piTuiTakeoverKey, JSON.stringify(enabled));
}
