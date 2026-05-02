import type { AppSettings } from "../../shared/desktop-contracts.ts";
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
import {
  type PreferenceRow,
  parseBooleanPreference,
  parseComposerStreamingBehaviorPreference,
  parseDictationModelIdPreference,
  parseFavoriteFolders,
  parseGitDiffBaselineDefaultPreference,
  parseGitDiffRenderModePreference,
  parseGitOpsModePreference,
  parseModelSelection,
  parseNumberPreference,
  parseProjectDeletionModePreference,
  parseStringPreference,
  parseThinkingLevelPreference,
} from "./parsers.cts";

export function loadAppSettings(): AppSettings {
  const db = getThreadStateDatabase();
  const chatModelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(chatModelKey) as PreferenceRow | undefined;
  const chatThinkingLevelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(chatThinkingLevelKey) as PreferenceRow | undefined;
  const codeModelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(codeModelKey) as PreferenceRow | undefined;
  const codeThinkingLevelRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(codeThinkingLevelKey) as PreferenceRow | undefined;
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
  const gitOpsDefaultModeRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(gitOpsDefaultModeKey) as PreferenceRow | undefined;
  const gitDiffBaselineDefaultRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(gitDiffBaselineDefaultKey) as PreferenceRow | undefined;
  const gitDiffFileTreeDefaultVisibleRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(gitDiffFileTreeDefaultVisibleKey) as PreferenceRow | undefined;
  const gitDiffRenderModeDefaultRow = db
    .prepare(
      `
        SELECT value_json AS valueJson
        FROM app_preferences
        WHERE key = ?
      `,
    )
    .get(gitDiffRenderModeDefaultKey) as PreferenceRow | undefined;
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
    chatModel: parseModelSelection(chatModelRow?.valueJson),
    chatThinkingLevel: parseThinkingLevelPreference(chatThinkingLevelRow?.valueJson),
    codeModel: parseModelSelection(codeModelRow?.valueJson),
    codeThinkingLevel: parseThinkingLevelPreference(codeThinkingLevelRow?.valueJson),
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
    gitOpsDefaultMode: parseGitOpsModePreference(gitOpsDefaultModeRow?.valueJson) ?? "commit",
    gitDiffBaselineDefault: parseGitDiffBaselineDefaultPreference(
      gitDiffBaselineDefaultRow?.valueJson,
    ) ?? { kind: "head" },
    gitDiffRenderModeDefault:
      parseGitDiffRenderModePreference(gitDiffRenderModeDefaultRow?.valueJson) ?? "stacked",
    gitDiffFileTreeDefaultVisible:
      parseBooleanPreference(gitDiffFileTreeDefaultVisibleRow?.valueJson) ?? true,
    projectDeletionMode:
      parseProjectDeletionModePreference(projectDeletionModeRow?.valueJson) ?? "pi-only",
    useAgentsSkillsPaths: parseBooleanPreference(useAgentsSkillsPathsRow?.valueJson) ?? false,
    piTuiTakeover: parseBooleanPreference(piTuiTakeoverRow?.valueJson) ?? false,
  };
}
