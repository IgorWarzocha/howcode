import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import type {
  ComposerSendMode,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DictationModelId,
  GitOpsMode,
  KeybindingOverrides,
  ModelSelection,
  ProjectDeletionMode,
  ProjectDiffDefaultBaseline,
  ProjectDiffRenderMode,
} from '../../shared/desktop-contracts.ts'
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  normalizeDictationMaxDurationSeconds,
} from '../../shared/dictation-settings.ts'
import { databaseOperation } from '../thread-state-db/db.ts'
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
  piTuiTakeoverKey,
  preferredProjectLocationKey,
  projectDashboardEnabledKey,
  projectDeletionModeKey,
  projectImportStateKey,
  showDictationButtonKey,
  sidebarVisibleProjectIdsKey,
  useAgentsSkillsPathsKey,
} from './keys.ts'

const writeAppPreference = Effect.fn('AppSettings.writePreference')(function* (
  key: string,
  valueJson: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      INSERT INTO app_preferences (key, value_json)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = CURRENT_TIMESTAMP
    `,
    [key, valueJson],
  )
})

const deleteAppPreference = Effect.fn('AppSettings.deletePreference')(function* (key: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      DELETE FROM app_preferences
      WHERE key = ?
    `,
    [key],
  )
})

const writeAppPreferenceSync = databaseOperation(writeAppPreference)
const deleteAppPreferenceSync = databaseOperation(deleteAppPreference)

export function setGitCommitMessageModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreferenceSync(gitCommitMessageModelKey)
    return
  }

  writeAppPreferenceSync(gitCommitMessageModelKey, JSON.stringify(selection))
}

export function setChatModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreferenceSync(chatModelKey)
    return
  }

  writeAppPreferenceSync(chatModelKey, JSON.stringify(selection))
}

export function setChatThinkingLevel(level: ComposerThinkingLevel | null) {
  if (!level) {
    deleteAppPreferenceSync(chatThinkingLevelKey)
    return
  }

  writeAppPreferenceSync(chatThinkingLevelKey, JSON.stringify(level))
}

export function setCodeModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreferenceSync(codeModelKey)
    return
  }

  writeAppPreferenceSync(codeModelKey, JSON.stringify(selection))
}

export function setCodeThinkingLevel(level: ComposerThinkingLevel | null) {
  if (!level) {
    deleteAppPreferenceSync(codeThinkingLevelKey)
    return
  }

  writeAppPreferenceSync(codeThinkingLevelKey, JSON.stringify(level))
}

export function setGitCommitMessageThinkingLevel(level: ComposerThinkingLevel) {
  writeAppPreferenceSync(gitCommitMessageThinkingLevelKey, JSON.stringify(level))
}

export function setComposerStreamingBehavior(behavior: ComposerStreamingBehavior) {
  writeAppPreferenceSync(composerStreamingBehaviorKey, JSON.stringify(behavior))
}

export function setDictationModelId(modelId: DictationModelId | null) {
  if (!modelId) {
    deleteAppPreferenceSync(dictationModelIdKey)
    return
  }

  writeAppPreferenceSync(dictationModelIdKey, JSON.stringify(modelId))
}

export function setDictationMaxDurationSeconds(value: number) {
  const normalizedValue = normalizeDictationMaxDurationSeconds(value)

  if (!normalizedValue || normalizedValue === DEFAULT_DICTATION_MAX_DURATION_SECONDS) {
    deleteAppPreferenceSync(dictationMaxDurationSecondsKey)
    return
  }

  writeAppPreferenceSync(dictationMaxDurationSecondsKey, JSON.stringify(normalizedValue))
}

export function setShowDictationButton(enabled: boolean) {
  if (enabled) {
    deleteAppPreferenceSync(showDictationButtonKey)
    return
  }

  writeAppPreferenceSync(showDictationButtonKey, JSON.stringify(false))
}

export function setFavoriteFolders(favoriteFolders: string[]) {
  const normalizedFavoriteFolderSet = new Set<string>()
  for (const folder of favoriteFolders) {
    const trimmedFolder = folder.trim()
    if (trimmedFolder) {
      normalizedFavoriteFolderSet.add(trimmedFolder)
    }
  }
  const normalizedFavoriteFolders = [...normalizedFavoriteFolderSet]

  if (normalizedFavoriteFolders.length === 0) {
    deleteAppPreferenceSync(favoriteFoldersKey)
    return
  }

  writeAppPreferenceSync(favoriteFoldersKey, JSON.stringify(normalizedFavoriteFolders))
}

export function setSidebarVisibleProjectIds(projectIds: string[]) {
  const normalizedProjectIds = [
    ...new Set(
      projectIds.flatMap((projectId) => {
        const trimmed = projectId.trim()
        return trimmed ? [trimmed] : []
      }),
    ),
  ]
  writeAppPreferenceSync(sidebarVisibleProjectIdsKey, JSON.stringify(normalizedProjectIds))
}

export function setProjectImportState(projectImportState: boolean | null) {
  if (projectImportState === null) {
    deleteAppPreferenceSync(projectImportStateKey)
    return
  }

  writeAppPreferenceSync(projectImportStateKey, JSON.stringify(projectImportState))
}

export function setPreferredProjectLocation(preferredProjectLocation: string | null) {
  const normalizedLocation = preferredProjectLocation?.trim() ?? ''
  if (normalizedLocation.length === 0) {
    deleteAppPreferenceSync(preferredProjectLocationKey)
    return
  }

  writeAppPreferenceSync(preferredProjectLocationKey, JSON.stringify(normalizedLocation))
}

export function setCustomPiDirectory(customPiDirectory: string | null) {
  const normalizedDirectory = customPiDirectory?.trim() ?? ''
  if (normalizedDirectory.length === 0) {
    deleteAppPreferenceSync(customPiDirectoryKey)
    return
  }

  writeAppPreferenceSync(customPiDirectoryKey, JSON.stringify(normalizedDirectory))
}

export function setInitializeGitOnProjectCreate(enabled: boolean) {
  writeAppPreferenceSync(initializeGitOnProjectCreateKey, JSON.stringify(enabled))
}

export function setProjectDashboardEnabled(enabled: boolean) {
  if (enabled) {
    deleteAppPreferenceSync(projectDashboardEnabledKey)
    return
  }

  writeAppPreferenceSync(projectDashboardEnabledKey, JSON.stringify(false))
}

export function setGitOpsDefaultMode(mode: GitOpsMode) {
  if (mode === 'commit') {
    deleteAppPreferenceSync(gitOpsDefaultModeKey)
    return
  }

  writeAppPreferenceSync(gitOpsDefaultModeKey, JSON.stringify(mode))
}

export function setGitDiffBaselineDefault(baseline: ProjectDiffDefaultBaseline) {
  if (baseline.kind === 'main-branch') {
    deleteAppPreferenceSync(gitDiffBaselineDefaultKey)
    return
  }

  writeAppPreferenceSync(gitDiffBaselineDefaultKey, JSON.stringify(baseline))
}

export function setGitDiffRenderModeDefault(mode: ProjectDiffRenderMode) {
  if (mode === 'stacked') {
    deleteAppPreferenceSync(gitDiffRenderModeDefaultKey)
    return
  }

  writeAppPreferenceSync(gitDiffRenderModeDefaultKey, JSON.stringify(mode))
}

export function setGitDiffFileTreeDefaultVisible(visible: boolean) {
  if (visible) {
    deleteAppPreferenceSync(gitDiffFileTreeDefaultVisibleKey)
    return
  }

  writeAppPreferenceSync(gitDiffFileTreeDefaultVisibleKey, JSON.stringify(false))
}

export function setGitDiffIncludeUntrackedDefault(enabled: boolean) {
  if (!enabled) {
    deleteAppPreferenceSync(gitDiffIncludeUntrackedDefaultKey)
    return
  }

  writeAppPreferenceSync(gitDiffIncludeUntrackedDefaultKey, JSON.stringify(true))
}

export function setProjectDeletionMode(mode: ProjectDeletionMode) {
  writeAppPreferenceSync(projectDeletionModeKey, JSON.stringify(mode))
}

export function setUseAgentsSkillsPaths(enabled: boolean) {
  writeAppPreferenceSync(useAgentsSkillsPathsKey, JSON.stringify(enabled))
}

export function setDevUpdateBranch(enabled: boolean) {
  writeAppPreferenceSync(devUpdateBranchKey, JSON.stringify(enabled))
}

export function setPiTuiTakeover(enabled: boolean) {
  writeAppPreferenceSync(piTuiTakeoverKey, JSON.stringify(enabled))
}

export function setHideSidebarSessionCounts(enabled: boolean) {
  if (!enabled) {
    deleteAppPreferenceSync(hideSidebarSessionCountsKey)
    return
  }

  writeAppPreferenceSync(hideSidebarSessionCountsKey, JSON.stringify(true))
}

export function setHoverToFocus(enabled: boolean) {
  if (enabled) {
    deleteAppPreferenceSync(hoverToFocusKey)
    return
  }

  writeAppPreferenceSync(hoverToFocusKey, JSON.stringify(false))
}

export function setHoverToBlur(enabled: boolean) {
  if (!enabled) {
    deleteAppPreferenceSync(hoverToBlurKey)
    return
  }

  writeAppPreferenceSync(hoverToBlurKey, JSON.stringify(true))
}

export function setKeybindings(keybindings: KeybindingOverrides) {
  if (Object.keys(keybindings).length === 0) {
    deleteAppPreferenceSync(keybindingsKey)
    return
  }

  writeAppPreferenceSync(keybindingsKey, JSON.stringify(keybindings))
}

export function setComposerSendMode(mode: ComposerSendMode) {
  if (mode === 'enter') {
    deleteAppPreferenceSync(composerSendModeKey)
    return
  }

  writeAppPreferenceSync(composerSendModeKey, JSON.stringify(mode))
}
