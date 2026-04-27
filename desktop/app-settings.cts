import type {
  AppSettings,
  ComposerThinkingLevel,
  ComposerStreamingBehavior,
  DictationModelId,
  ModelSelection,
  ProjectDeletionMode,
} from "../shared/desktop-contracts.ts";
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  normalizeDictationMaxDurationSeconds,
} from "../shared/dictation-settings.ts";
import { getThreadStateDatabase } from "./thread-state-db/db.cts";

const gitCommitMessageModelKey = "gitCommitMessageModel";
const gitCommitMessageThinkingLevelKey = "gitCommitMessageThinkingLevel";
const skillCreatorModelKey = "skillCreatorModel";
const skillCreatorThinkingLevelKey = "skillCreatorThinkingLevel";
const composerStreamingBehaviorKey = "composerStreamingBehavior";
const dictationModelIdKey = "dictationModelId";
const dictationMaxDurationSecondsKey = "dictationMaxDurationSeconds";
const showDictationButtonKey = "showDictationButton";
const favoriteFoldersKey = "favoriteFolders";
const projectImportStateKey = "projectImportState";
const preferredProjectLocationKey = "preferredProjectLocation";
const initializeGitOnProjectCreateKey = "initializeGitOnProjectCreate";
const projectDeletionModeKey = "projectDeletionMode";
const useAgentsSkillsPathsKey = "useAgentsSkillsPaths";
const piTuiTakeoverKey = "piTuiTakeover";

type PreferenceRow = {
  valueJson: string;
};

function parseModelSelection(valueJson: string | null | undefined): ModelSelection | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as { id?: unknown; provider?: unknown };
    return typeof parsed.provider === "string" && typeof parsed.id === "string"
      ? { provider: parsed.provider, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

function parseFavoriteFolders(valueJson: string | null | undefined): string[] {
  if (!valueJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function parseBooleanPreference(valueJson: string | null | undefined): boolean | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return typeof parsed === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

function parseStringPreference(valueJson: string | null | undefined): string | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return typeof parsed === "string" && parsed.trim().length > 0 ? parsed.trim() : null;
  } catch {
    return null;
  }
}

function parseNumberPreference(valueJson: string | null | undefined): number | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseThinkingLevelPreference(
  valueJson: string | null | undefined,
): ComposerThinkingLevel | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "off" ||
      parsed === "minimal" ||
      parsed === "low" ||
      parsed === "medium" ||
      parsed === "high" ||
      parsed === "xhigh"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function parseProjectDeletionModePreference(
  valueJson: string | null | undefined,
): ProjectDeletionMode | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "pi-only" || parsed === "full-clean" ? parsed : null;
  } catch {
    return null;
  }
}

function parseComposerStreamingBehaviorPreference(
  valueJson: string | null | undefined,
): ComposerStreamingBehavior | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "steer" || parsed === "followUp" || parsed === "stop" ? parsed : null;
  } catch {
    return null;
  }
}

function parseDictationModelIdPreference(
  valueJson: string | null | undefined,
): DictationModelId | null {
  if (!valueJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(valueJson) as unknown;
    return parsed === "tiny.en" || parsed === "base.en" || parsed === "small.en" ? parsed : null;
  } catch {
    return null;
  }
}

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

export function loadAppSettings(): AppSettings {
  const db = getThreadStateDatabase();
  const modelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(gitCommitMessageModelKey) as PreferenceRow | undefined;
  const gitCommitThinkingLevelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(gitCommitMessageThinkingLevelKey) as PreferenceRow | undefined;
  const favoriteFoldersRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(favoriteFoldersKey) as PreferenceRow | undefined;
  const skillCreatorModelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(skillCreatorModelKey) as PreferenceRow | undefined;
  const skillCreatorThinkingLevelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(skillCreatorThinkingLevelKey) as PreferenceRow | undefined;
  const composerStreamingBehaviorRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(composerStreamingBehaviorKey) as PreferenceRow | undefined;
  const projectImportStateRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(projectImportStateKey) as PreferenceRow | undefined;
  const preferredProjectLocationRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(preferredProjectLocationKey) as PreferenceRow | undefined;
  const initializeGitOnProjectCreateRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(initializeGitOnProjectCreateKey) as PreferenceRow | undefined;
  const projectDeletionModeRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(projectDeletionModeKey) as PreferenceRow | undefined;
  const useAgentsSkillsPathsRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(useAgentsSkillsPathsKey) as PreferenceRow | undefined;
  const piTuiTakeoverRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(piTuiTakeoverKey) as PreferenceRow | undefined;
  const dictationModelIdRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(dictationModelIdKey) as PreferenceRow | undefined;
  const dictationMaxDurationSecondsRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(dictationMaxDurationSecondsKey) as PreferenceRow | undefined;
  const showDictationButtonRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(showDictationButtonKey) as PreferenceRow | undefined;

  return {
    gitCommitMessageModel: parseModelSelection(modelRow?.valueJson),
    gitCommitMessageThinkingLevel:
      parseThinkingLevelPreference(gitCommitThinkingLevelRow?.valueJson) ?? "off",
    skillCreatorModel: parseModelSelection(skillCreatorModelRow?.valueJson),
    skillCreatorThinkingLevel:
      parseThinkingLevelPreference(skillCreatorThinkingLevelRow?.valueJson) ?? "off",
    composerStreamingBehavior:
      parseComposerStreamingBehaviorPreference(composerStreamingBehaviorRow?.valueJson) ??
      "followUp",
    dictationModelId: parseDictationModelIdPreference(dictationModelIdRow?.valueJson),
    dictationMaxDurationSeconds:
      normalizeDictationMaxDurationSeconds(
        parseNumberPreference(dictationMaxDurationSecondsRow?.valueJson),
      ) ?? DEFAULT_DICTATION_MAX_DURATION_SECONDS,
    showDictationButton: parseBooleanPreference(showDictationButtonRow?.valueJson) ?? true,
    favoriteFolders: parseFavoriteFolders(favoriteFoldersRow?.valueJson),
    projectImportState: parseBooleanPreference(projectImportStateRow?.valueJson),
    preferredProjectLocation: parseStringPreference(preferredProjectLocationRow?.valueJson),
    initializeGitOnProjectCreate:
      parseBooleanPreference(initializeGitOnProjectCreateRow?.valueJson) ?? false,
    projectDeletionMode:
      parseProjectDeletionModePreference(projectDeletionModeRow?.valueJson) ?? "pi-only",
    useAgentsSkillsPaths: parseBooleanPreference(useAgentsSkillsPathsRow?.valueJson) ?? false,
    piTuiTakeover: parseBooleanPreference(piTuiTakeoverRow?.valueJson) ?? false,
  };
}

export function setGitCommitMessageModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreference(gitCommitMessageModelKey);
    return;
  }

  writeAppPreference(gitCommitMessageModelKey, JSON.stringify(selection));
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

export function setProjectDeletionMode(mode: ProjectDeletionMode) {
  writeAppPreference(projectDeletionModeKey, JSON.stringify(mode));
}

export function setUseAgentsSkillsPaths(enabled: boolean) {
  writeAppPreference(useAgentsSkillsPathsKey, JSON.stringify(enabled));
}

export function setPiTuiTakeover(enabled: boolean) {
  writeAppPreference(piTuiTakeoverKey, JSON.stringify(enabled));
}
