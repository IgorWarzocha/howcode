import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SqlClient from 'effect/sql/SqlClient'
import type { AppSettings } from '../../shared/desktop-contracts.ts'
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  normalizeDictationMaxDurationSeconds,
} from '../../shared/dictation-settings.ts'
import { PeopleSchema } from '../../shared/people.ts'
import { EnabledToolkitComponentsSchema } from '../../shared/toolkit-components.ts'
import { databaseOperation } from '../chat-repository/db.ts'
import {
  composerSendModeKey,
  composerStreamingBehaviorKey,
  customPiDirectoryKey,
  defaultModelKey,
  defaultThinkingLevelKey,
  dictationMaxDurationSecondsKey,
  dictationModelIdKey,
  dictationProviderKey,
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
  navigationRendererKey,
  preferredDirectoryLocationKey,
  shellPreferencesKey,
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
    navigationRenderer:
      parseStringPreference(value(navigationRendererKey)) ?? '@howaboua/howcode-classic-navigation',
  }
}

function parseEnabledToolkitComponents(value: string | undefined) {
  if (value === undefined) return undefined
  const enabledComponents: unknown = JSON.parse(value)
  // Retire flags whose features now use managed component lifecycles.
  return Schema.decodeUnknownSync(EnabledToolkitComponentsSchema)(
    Array.isArray(enabledComponents)
      ? enabledComponents.filter(
          (id) => id !== 'coding' && id !== 'artifacts' && id !== 'dictation',
        )
      : enabledComponents,
  )
}

const loadAppSettingsOperation = Effect.fn('AppSettings.load')(function* () {
  const rows = yield* loadPreferenceRows()
  const value = (key: string) => rows.get(key)?.valueJson
  const enabledToolkitComponents = parseEnabledToolkitComponents(value(enabledToolkitComponentsKey))

  return {
    ...(enabledToolkitComponents === undefined ? {} : { enabledToolkitComponents }),
    people: Schema.decodeUnknownSync(PeopleSchema)(JSON.parse(value('people') ?? '[]')),
    defaultModel: parseModelSelection(value(defaultModelKey)),
    defaultThinkingLevel: parseThinkingLevelPreference(value(defaultThinkingLevelKey)),
    gitCommitMessageModel: parseModelSelection(value(gitCommitMessageModelKey)),
    gitCommitMessageThinkingLevel:
      parseThinkingLevelPreference(value(gitCommitMessageThinkingLevelKey)) ?? 'off',
    composerStreamingBehavior:
      parseComposerStreamingBehaviorPreference(value(composerStreamingBehaviorKey)) ?? 'followUp',
    dictationModelId: parseDictationModelIdPreference(value(dictationModelIdKey)),
    dictationProvider: parseStringPreference(value(dictationProviderKey)) ?? 'auto',
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

export const readShellPreferencesJson: () => string | undefined = databaseOperation(
  Effect.fn('AppSettings.readShellPreferences')(function* () {
    return (yield* loadPreferenceRows()).get(shellPreferencesKey)?.valueJson
  }),
)

// One-time migration boundary: projects is the legacy Howcode directory registry.
export const readLegacyShellPreferenceScopes = databaseOperation(
  Effect.fn('AppSettings.readLegacyShellPreferenceScopes')(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe('SELECT cwd FROM projects')
    const directories = Schema.decodeUnknownSync(
      Schema.Array(Schema.Struct({ cwd: Schema.String })),
    )(rows).map((row) => row.cwd)
    return {
      directories,
      existingUser: directories.length > 0 || (yield* loadPreferenceRows()).size > 0,
    }
  }),
)
