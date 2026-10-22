import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import type {
  ComposerSendMode,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DirectoryDeletionMode,
  DirectoryDiffDefaultBaseline,
  DirectoryDiffRenderMode,
  GitOpsMode,
  KeybindingOverrides,
  ModelSelection,
} from '../../shared/desktop-contracts.ts'
import type { ToolkitComponentId } from '../../shared/toolkit-components.ts'
import { databaseOperation } from '../chat-repository/db.ts'
import {
  composerSendModeKey,
  composerStreamingBehaviorKey,
  customPiDirectoryKey,
  defaultModelKey,
  defaultThinkingLevelKey,
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
  sidebarVisibleDirectoryIdsKey,
  skillsPreferencesKey,
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
export function writeSkillsPreferencesJson(valueJson: string) {
  writeAppPreferenceSync(skillsPreferencesKey, valueJson)
}
export function writeShellPreferencesJson(valueJson: string) {
  writeAppPreferenceSync(shellPreferencesKey, valueJson)
}
export function setNavigationRenderer(value: string) {
  writeAppPreferenceSync(navigationRendererKey, JSON.stringify(value))
}
export function setDictationProvider(value: string) {
  writeAppPreferenceSync(dictationProviderKey, JSON.stringify(value))
}
const deleteAppPreferenceSync = databaseOperation(deleteAppPreference)

export function setGitCommitMessageModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreferenceSync(gitCommitMessageModelKey)
    return
  }

  writeAppPreferenceSync(gitCommitMessageModelKey, JSON.stringify(selection))
}

export function setDefaultModelSelection(selection: ModelSelection | null) {
  if (!selection) {
    deleteAppPreferenceSync(defaultModelKey)
    return
  }

  writeAppPreferenceSync(defaultModelKey, JSON.stringify(selection))
}

export function setDefaultThinkingLevel(level: ComposerThinkingLevel | null) {
  if (!level) {
    deleteAppPreferenceSync(defaultThinkingLevelKey)
    return
  }

  writeAppPreferenceSync(defaultThinkingLevelKey, JSON.stringify(level))
}

export function setGitCommitMessageThinkingLevel(level: ComposerThinkingLevel) {
  writeAppPreferenceSync(gitCommitMessageThinkingLevelKey, JSON.stringify(level))
}

export function setComposerStreamingBehavior(behavior: ComposerStreamingBehavior) {
  writeAppPreferenceSync(composerStreamingBehaviorKey, JSON.stringify(behavior))
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

export function setSidebarVisibleDirectoryIds(directoryIds: string[]) {
  const normalizedDirectoryIds = [
    ...new Set(
      directoryIds.flatMap((directoryId) => {
        const trimmed = directoryId.trim()
        return trimmed ? [trimmed] : []
      }),
    ),
  ]
  writeAppPreferenceSync(sidebarVisibleDirectoryIdsKey, JSON.stringify(normalizedDirectoryIds))
}

export function setDirectoryImportState(directoryImportState: boolean | null) {
  if (directoryImportState === null) {
    deleteAppPreferenceSync(directoryImportStateKey)
    return
  }

  writeAppPreferenceSync(directoryImportStateKey, JSON.stringify(directoryImportState))
}

export function setPreferredDirectoryLocation(preferredDirectoryLocation: string | null) {
  const normalizedLocation = preferredDirectoryLocation?.trim() ?? ''
  if (normalizedLocation.length === 0) {
    deleteAppPreferenceSync(preferredDirectoryLocationKey)
    return
  }

  writeAppPreferenceSync(preferredDirectoryLocationKey, JSON.stringify(normalizedLocation))
}

export function setCustomPiDirectory(customPiDirectory: string | null) {
  const normalizedDirectory = customPiDirectory?.trim() ?? ''
  if (normalizedDirectory.length === 0) {
    deleteAppPreferenceSync(customPiDirectoryKey)
    return
  }

  writeAppPreferenceSync(customPiDirectoryKey, JSON.stringify(normalizedDirectory))
}

export function setInitializeGitOnDirectoryCreate(enabled: boolean) {
  writeAppPreferenceSync(initializeGitOnDirectoryCreateKey, JSON.stringify(enabled))
}

export function setDirectoryDashboardEnabled(enabled: boolean) {
  if (enabled) {
    deleteAppPreferenceSync(directoryDashboardEnabledKey)
    return
  }

  writeAppPreferenceSync(directoryDashboardEnabledKey, JSON.stringify(false))
}

export function setGitOpsDefaultMode(mode: GitOpsMode) {
  if (mode === 'commit') {
    deleteAppPreferenceSync(gitOpsDefaultModeKey)
    return
  }

  writeAppPreferenceSync(gitOpsDefaultModeKey, JSON.stringify(mode))
}

export function setGitDiffBaselineDefault(baseline: DirectoryDiffDefaultBaseline) {
  if (baseline.kind === 'main-branch') {
    deleteAppPreferenceSync(gitDiffBaselineDefaultKey)
    return
  }

  writeAppPreferenceSync(gitDiffBaselineDefaultKey, JSON.stringify(baseline))
}

export function setGitDiffRenderModeDefault(mode: DirectoryDiffRenderMode) {
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

export function setDirectoryDeletionMode(mode: DirectoryDeletionMode) {
  writeAppPreferenceSync(directoryDeletionModeKey, JSON.stringify(mode))
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

export function setEnabledToolkitComponents(value: readonly ToolkitComponentId[]) {
  writeAppPreferenceSync(enabledToolkitComponentsKey, JSON.stringify(value))
}
