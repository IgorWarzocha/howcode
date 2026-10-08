import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import type { AppSettings } from '../../shared/desktop-contracts.ts'
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  normalizeDictationMaxDurationSeconds,
} from '../../shared/dictation-settings.ts'
import { EnabledToolkitComponentsSchema } from '../../shared/toolkit-components.ts'
import { databaseOperation } from '../chat-repository/db.ts'
import {
  chatModelKey,
  chatThinkingLevelKey,
  codeModelKey,
  codeThinkingLevelKey,
  composerSendModeKey,
  composerStreamingBehaviorKey,
  customPiDirectoryKey,
  dictationMaxDurationSecondsKey,
  dictationModelIdKey,
  directoryDashboardEnabledKey,
  directoryDeletionModeKey,
  directoryImportStateKey,
  enabledToolkitComponentsKey,
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
  initializeGitOnDirectoryCreateKey,
  keybindingsKey,
  preferredDirectoryLocationKey,
  showDictationButtonKey,
  sidebarVisibleDirectoryIdsKey,
  useAgentsSkillsPathsKey,
} from './keys.ts'
import {
  type PreferenceRow,
  parseBooleanPreference,
  parseComposerSendModePreference,
  parseComposerStreamingBehaviorPreference,
  parseDictationModelIdPreference,
  parseDirectoryDeletionModePreference,
  parseFavoriteFolders,
  parseGitDiffBaselineDefaultPreference,
  parseGitDiffRenderModePreference,
  parseGitOpsModePreference,
  parseKeybindingOverrides,
  parseModelSelection,
  parseNumberPreference,
  parseStringPreference,
  parseThinkingLevelPreference,
} from './parsers.ts'

const loadPreferenceRows = Effect.fn('AppSettings.loadPreferenceRows')(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<PreferenceRow & { key: string }>(
    `
        SELECT key, value_json AS valueJson
        FROM app_preferences
      `,
  )

  return new Map(rows.map((row) => [row.key, row] as const))
})

function getDictationMaxDurationSeconds(valueJson: string | undefined) {
  return (
    normalizeDictationMaxDurationSeconds(parseNumberPreference(valueJson)) ??
    DEFAULT_DICTATION_MAX_DURATION_SECONDS
  )
}

function loadKeybindingSettings(value: (key: string) => string | undefined) {
  return {
    keybindings: parseKeybindingOverrides(value(keybindingsKey)),
    composerSendMode: parseComposerSendModePreference(value(composerSendModeKey)) ?? 'enter',
  }
}

const loadSidebarVisibleDirectoryIdsOperation = Effect.fn(
  'AppSettings.loadSidebarVisibleDirectoryIds',
)(function* () {
  const rows = yield* loadPreferenceRows()
  const valueJson = rows.get(sidebarVisibleDirectoryIdsKey)?.valueJson
  return valueJson === undefined ? null : parseFavoriteFolders(valueJson)
})

export const loadSidebarVisibleDirectoryIds: () => string[] | null = databaseOperation(
  loadSidebarVisibleDirectoryIdsOperation,
)

function loadDirectoryUiSettings(value: (key: string) => string | undefined) {
  return {
    initializeGitOnDirectoryCreate:
      parseBooleanPreference(value(initializeGitOnDirectoryCreateKey)) ?? false,
    directoryDashboardEnabled: parseBooleanPreference(value(directoryDashboardEnabledKey)) ?? true,
    hideSidebarSessionCounts: parseBooleanPreference(value(hideSidebarSessionCountsKey)) ?? false,
  }
}

const loadAppSettingsOperation = Effect.fn('AppSettings.load')(function* () {
  const rows = yield* loadPreferenceRows()
  const value = (key: string) => rows.get(key)?.valueJson

  return {
    ...(value(enabledToolkitComponentsKey) === undefined
      ? {}
      : {
          enabledToolkitComponents: Schema.decodeUnknownSync(EnabledToolkitComponentsSchema)(
            JSON.parse(value(enabledToolkitComponentsKey) ?? 'null'),
          ),
        }),
    chatModel: parseModelSelection(value(chatModelKey)),
    chatThinkingLevel: parseThinkingLevelPreference(value(chatThinkingLevelKey)),
    codeModel: parseModelSelection(value(codeModelKey)),
    codeThinkingLevel: parseThinkingLevelPreference(value(codeThinkingLevelKey)),
    gitCommitMessageModel: parseModelSelection(value(gitCommitMessageModelKey)),
    gitCommitMessageThinkingLevel:
      parseThinkingLevelPreference(value(gitCommitMessageThinkingLevelKey)) ?? 'off',
    composerStreamingBehavior:
      parseComposerStreamingBehaviorPreference(value(composerStreamingBehaviorKey)) ?? 'followUp',
    dictationModelId: parseDictationModelIdPreference(value(dictationModelIdKey)),
    dictationMaxDurationSeconds: getDictationMaxDurationSeconds(
      value(dictationMaxDurationSecondsKey),
    ),
    showDictationButton: parseBooleanPreference(value(showDictationButtonKey)) ?? true,
    favoriteFolders: parseFavoriteFolders(value(favoriteFoldersKey)),
    directoryImportState: parseBooleanPreference(value(directoryImportStateKey)),
    preferredDirectoryLocation: parseStringPreference(value(preferredDirectoryLocationKey)),
    customPiDirectory: parseStringPreference(value(customPiDirectoryKey)),
    ...loadDirectoryUiSettings(value),
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
    directoryDeletionMode:
      parseDirectoryDeletionModePreference(value(directoryDeletionModeKey)) ?? 'pi-only',
    useAgentsSkillsPaths: parseBooleanPreference(value(useAgentsSkillsPathsKey)) ?? false,
    hoverToFocus: parseBooleanPreference(value(hoverToFocusKey)) ?? true,
    hoverToBlur: parseBooleanPreference(value(hoverToBlurKey)) ?? false,
    ...loadKeybindingSettings(value),
  }
})

export const loadAppSettings: () => AppSettings = databaseOperation(loadAppSettingsOperation)
