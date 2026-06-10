import type { AppSettings } from '../../shared/desktop-contracts.ts'
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  normalizeDictationMaxDurationSeconds,
} from '../../shared/dictation-settings.ts'
import { getThreadStateDatabase } from '../thread-state-db/db.ts'
import {
  chatModelKey,
  chatThinkingLevelKey,
  codeModelKey,
  codeThinkingLevelKey,
  composerSendModeKey,
  composerStreamingBehaviorKey,
  customPiDirectoryKey,
  devUpdateBranchKey,
  dictationMaxDurationSecondsKey,
  dictationModelIdKey,
  favoriteFoldersKey,
  gitCommitMessageModelKey,
  gitCommitMessageThinkingLevelKey,
  gitDiffBaselineDefaultKey,
  gitDiffFileTreeDefaultVisibleKey,
  gitDiffIncludeUntrackedDefaultKey,
  gitDiffRenderModeDefaultKey,
  gitOpsDefaultModeKey,
  hideSidebarSessionCountsKey,
  hoverToBlurKey,
  hoverToFocusKey,
  initializeGitOnProjectCreateKey,
  keybindingsKey,
  legacyDevUpdateBranchKey,
  piTuiTakeoverKey,
  preferredProjectLocationKey,
  projectDashboardEnabledKey,
  projectDeletionModeKey,
  projectImportStateKey,
  showDictationButtonKey,
  sidebarVisibleProjectIdsKey,
  skillCreatorModelKey,
  skillCreatorThinkingLevelKey,
  smartBtwModelKey,
  smartBtwThinkingLevelKey,
  useAgentsSkillsPathsKey,
} from './keys.ts'
import {
  type PreferenceRow,
  parseBooleanPreference,
  parseComposerSendModePreference,
  parseComposerStreamingBehaviorPreference,
  parseDictationModelIdPreference,
  parseFavoriteFolders,
  parseGitDiffBaselineDefaultPreference,
  parseGitDiffRenderModePreference,
  parseGitOpsModePreference,
  parseKeybindingOverrides,
  parseModelSelection,
  parseNumberPreference,
  parseProjectDeletionModePreference,
  parseStringPreference,
  parseThinkingLevelPreference,
} from './parsers.ts'

function loadPreferenceRows() {
  const rows = getThreadStateDatabase()
    .prepare(
      `
        SELECT key, value_json AS valueJson
        FROM app_preferences
      `,
    )
    .all() as Array<PreferenceRow & { key: string }>

  return new Map(rows.map((row) => [row.key, row] as const))
}

function getDictationMaxDurationSeconds(valueJson: string | undefined) {
  return (
    normalizeDictationMaxDurationSeconds(parseNumberPreference(valueJson)) ??
    DEFAULT_DICTATION_MAX_DURATION_SECONDS
  )
}

function getDevUpdateBranch(valueJson: string | undefined) {
  return parseBooleanPreference(valueJson) ?? false
}

function getDevUpdateBranchValue(value: (key: string) => string | undefined) {
  return value(devUpdateBranchKey) ?? value(legacyDevUpdateBranchKey)
}

function loadKeybindingSettings(value: (key: string) => string | undefined) {
  return {
    keybindings: parseKeybindingOverrides(value(keybindingsKey)),
    composerSendMode: parseComposerSendModePreference(value(composerSendModeKey)) ?? 'enter',
  }
}

export function loadSidebarVisibleProjectIds(): string[] | null {
  const rows = loadPreferenceRows()
  const valueJson = rows.get(sidebarVisibleProjectIdsKey)?.valueJson
  return valueJson === undefined ? null : parseFavoriteFolders(valueJson)
}

function loadProjectUiSettings(value: (key: string) => string | undefined) {
  return {
    initializeGitOnProjectCreate:
      parseBooleanPreference(value(initializeGitOnProjectCreateKey)) ?? false,
    projectDashboardEnabled: parseBooleanPreference(value(projectDashboardEnabledKey)) ?? true,
    hideSidebarSessionCounts: parseBooleanPreference(value(hideSidebarSessionCountsKey)) ?? false,
  }
}

export function loadAppSettings(): AppSettings {
  const rows = loadPreferenceRows()
  const value = (key: string) => rows.get(key)?.valueJson

  return {
    chatModel: parseModelSelection(value(chatModelKey)),
    chatThinkingLevel: parseThinkingLevelPreference(value(chatThinkingLevelKey)),
    codeModel: parseModelSelection(value(codeModelKey)),
    codeThinkingLevel: parseThinkingLevelPreference(value(codeThinkingLevelKey)),
    gitCommitMessageModel: parseModelSelection(value(gitCommitMessageModelKey)),
    gitCommitMessageThinkingLevel:
      parseThinkingLevelPreference(value(gitCommitMessageThinkingLevelKey)) ?? 'off',
    skillCreatorModel: parseModelSelection(value(skillCreatorModelKey)),
    skillCreatorThinkingLevel:
      parseThinkingLevelPreference(value(skillCreatorThinkingLevelKey)) ?? 'off',
    smartBtwModel: parseModelSelection(value(smartBtwModelKey)),
    smartBtwThinkingLevel: parseThinkingLevelPreference(value(smartBtwThinkingLevelKey)) ?? 'low',
    composerStreamingBehavior:
      parseComposerStreamingBehaviorPreference(value(composerStreamingBehaviorKey)) ?? 'followUp',
    dictationModelId: parseDictationModelIdPreference(value(dictationModelIdKey)),
    dictationMaxDurationSeconds: getDictationMaxDurationSeconds(
      value(dictationMaxDurationSecondsKey),
    ),
    showDictationButton: parseBooleanPreference(value(showDictationButtonKey)) ?? true,
    favoriteFolders: parseFavoriteFolders(value(favoriteFoldersKey)),
    projectImportState: parseBooleanPreference(value(projectImportStateKey)),
    preferredProjectLocation: parseStringPreference(value(preferredProjectLocationKey)),
    customPiDirectory: parseStringPreference(value(customPiDirectoryKey)),
    ...loadProjectUiSettings(value),
    gitOpsDefaultMode: parseGitOpsModePreference(value(gitOpsDefaultModeKey)) ?? 'commit',
    gitDiffBaselineDefault: parseGitDiffBaselineDefaultPreference(
      value(gitDiffBaselineDefaultKey),
    ) ?? { kind: 'main-branch' },
    gitDiffRenderModeDefault:
      parseGitDiffRenderModePreference(value(gitDiffRenderModeDefaultKey)) ?? 'stacked',
    gitDiffFileTreeDefaultVisible:
      parseBooleanPreference(value(gitDiffFileTreeDefaultVisibleKey)) ?? true,
    gitDiffIncludeUntrackedDefault:
      parseBooleanPreference(value(gitDiffIncludeUntrackedDefaultKey)) ?? false,
    projectDeletionMode:
      parseProjectDeletionModePreference(value(projectDeletionModeKey)) ?? 'pi-only',
    useAgentsSkillsPaths: parseBooleanPreference(value(useAgentsSkillsPathsKey)) ?? false,
    devUpdateBranch: getDevUpdateBranch(getDevUpdateBranchValue(value)),
    piTuiTakeover: parseBooleanPreference(value(piTuiTakeoverKey)) ?? false,
    hoverToFocus: parseBooleanPreference(value(hoverToFocusKey)) ?? true,
    hoverToBlur: parseBooleanPreference(value(hoverToBlurKey)) ?? false,
    ...loadKeybindingSettings(value),
  }
}
