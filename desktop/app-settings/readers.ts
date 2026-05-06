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
  hoverToBlurKey,
  hoverToFocusKey,
  howcodeNativeAskQuestionsKey,
  initializeGitOnProjectCreateKey,
  piTuiTakeoverKey,
  preferredProjectLocationKey,
  projectDeletionModeKey,
  projectImportStateKey,
  showDictationButtonKey,
  skillCreatorModelKey,
  skillCreatorThinkingLevelKey,
  useAgentsSkillsPathsKey,
} from './keys.ts'
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
    initializeGitOnProjectCreate:
      parseBooleanPreference(value(initializeGitOnProjectCreateKey)) ?? false,
    gitOpsDefaultMode: parseGitOpsModePreference(value(gitOpsDefaultModeKey)) ?? 'commit',
    gitDiffBaselineDefault: parseGitDiffBaselineDefaultPreference(
      value(gitDiffBaselineDefaultKey),
    ) ?? { kind: 'head' },
    gitDiffRenderModeDefault:
      parseGitDiffRenderModePreference(value(gitDiffRenderModeDefaultKey)) ?? 'stacked',
    gitDiffFileTreeDefaultVisible:
      parseBooleanPreference(value(gitDiffFileTreeDefaultVisibleKey)) ?? true,
    projectDeletionMode:
      parseProjectDeletionModePreference(value(projectDeletionModeKey)) ?? 'pi-only',
    useAgentsSkillsPaths: parseBooleanPreference(value(useAgentsSkillsPathsKey)) ?? false,
    howcodeNativeAskQuestions: parseBooleanPreference(value(howcodeNativeAskQuestionsKey)) ?? false,
    piTuiTakeover: parseBooleanPreference(value(piTuiTakeoverKey)) ?? false,
    hoverToFocus: parseBooleanPreference(value(hoverToFocusKey)) ?? true,
    hoverToBlur: parseBooleanPreference(value(hoverToBlurKey)) ?? false,
  }
}
