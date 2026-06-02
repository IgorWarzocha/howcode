import { readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import {
  getSettingsBooleanValue,
  getSettingsComposerStreamingBehavior,
  getSettingsDictationModelId,
  getSettingsFavoriteFolders,
  getSettingsKey,
  getSettingsModelSelection,
  getSettingsNumberValue,
  getSettingsPreferredProjectLocation,
  getSettingsProjectDeletionMode,
  getSettingsProjectDiffBaselineDefault,
  getSettingsProjectDiffRenderModeDefault,
  getSettingsProjectImportState,
  getSettingsReset,
  getSettingsThinkingLevel,
} from '../../shared/pi-thread-action-payloads.ts'
import { parseKeybindingOverrides } from '../app-settings/parsers.ts'
import { normalizeOptionalSettingsPath } from '../app-settings/path-normalization.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import {
  setChatModelSelection,
  setChatThinkingLevel,
  setCodeModelSelection,
  setCodeThinkingLevel,
  setComposerSendMode,
  setComposerStreamingBehavior,
  setCustomPiDirectory,
  setDevUpdateBranch,
  setDictationMaxDurationSeconds,
  setDictationModelId,
  setFavoriteFolders,
  setGitCommitMessageModelSelection,
  setGitCommitMessageThinkingLevel,
  setGitDiffBaselineDefault,
  setGitDiffFileTreeDefaultVisible,
  setGitDiffIncludeUntrackedDefault,
  setGitDiffRenderModeDefault,
  setGitOpsDefaultMode,
  setHideSidebarSessionCounts,
  setHoverToBlur,
  setHoverToFocus,
  setHowcodeNativeAskQuestions,
  setHowcodeNativeSmartBtw,
  setInitializeGitOnProjectCreate,
  setKeybindings,
  setPiTuiTakeover,
  setPreferredProjectLocation,
  setProjectDashboardEnabled,
  setProjectDeletionMode,
  setProjectImportState,
  setShowDictationButton,
  setSkillCreatorModelSelection,
  setSkillCreatorThinkingLevel,
  setSmartBtwModelSelection,
  setSmartBtwThinkingLevel,
  setUseAgentsSkillsPaths,
} from '../app-settings/writers.ts'
import { restartRuntimeHostsForEnvironmentChange } from '../runtime-host/client-bridge.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

const clipboardImageTempDir = path.join(tmpdir(), 'howcode-clipboard-images')

async function clearClipboardImageTempFiles() {
  let entries: Array<{ isFile(): boolean; name: string }>
  try {
    entries = await readdir(clipboardImageTempDir, { withFileTypes: true })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return { clearedCount: 0, clearFailedCount: 0 }
    }

    return { clearedCount: 0, clearFailedCount: 1 }
  }

  const targets = entries.filter(
    (entry) =>
      entry.isFile() && entry.name.startsWith('howcode-clipboard-') && entry.name.endsWith('.png'),
  )
  const results = await Promise.allSettled(
    targets.map((entry) => rm(path.join(clipboardImageTempDir, entry.name), { force: true })),
  )
  return {
    clearedCount: results.filter((result) => result.status === 'fulfilled').length,
    clearFailedCount: results.filter((result) => result.status === 'rejected').length,
  }
}

type SettingsUpdateHandler = (payload: AnyDesktopActionPayload) => unknown

function isSettingsUpdateResult(value: unknown) {
  return typeof value === 'object' && value !== null
}

function setOptionalBooleanSetting(
  payload: AnyDesktopActionPayload,
  setter: (value: boolean) => void,
) {
  const value = getSettingsBooleanValue(payload)
  if (value !== null) setter(value)
}

function setResettableModelSelection(
  payload: AnyDesktopActionPayload,
  setter: (value: ReturnType<typeof getSettingsModelSelection> | null) => void,
) {
  if (getSettingsReset(payload)) {
    setter(null)
    return
  }

  const selection = getSettingsModelSelection(payload)
  if (selection) setter(selection)
}

function setResettableThinkingLevel(
  payload: AnyDesktopActionPayload,
  setter: (value: ReturnType<typeof getSettingsThinkingLevel> | null) => void,
) {
  if (getSettingsReset(payload)) {
    setter(null)
    return
  }

  const level = getSettingsThinkingLevel(payload)
  if (level) setter(level)
}

function setOptionalThinkingLevel(
  payload: AnyDesktopActionPayload,
  setter: (value: NonNullable<ReturnType<typeof getSettingsThinkingLevel>>) => void,
) {
  const level = getSettingsThinkingLevel(payload)
  if (level) setter(level)
}

const settingsUpdateHandlers = {
  favoriteFolders: (payload) => setFavoriteFolders(getSettingsFavoriteFolders(payload)),
  composerStreamingBehavior: (payload) => {
    const value = getSettingsComposerStreamingBehavior(payload)
    if (value) setComposerStreamingBehavior(value)
  },
  dictationModelId: (payload) => setDictationModelId(getSettingsDictationModelId(payload)),
  dictationMaxDurationSeconds: (payload) => {
    const value = getSettingsNumberValue(payload)
    if (value !== null) setDictationMaxDurationSeconds(value)
  },
  showDictationButton: (payload) =>
    setShowDictationButton(getSettingsBooleanValue(payload) ?? true),
  projectImportState: (payload) => setProjectImportState(getSettingsProjectImportState(payload)),
  useAgentsSkillsPaths: (payload) =>
    setUseAgentsSkillsPaths(getSettingsBooleanValue(payload) ?? false),
  howcodeNativeAskQuestions: (payload) => {
    setHowcodeNativeAskQuestions(getSettingsBooleanValue(payload) ?? false)
    restartRuntimeHostsForEnvironmentChange()
  },
  howcodeNativeSmartBtw: (payload) => {
    setHowcodeNativeSmartBtw(getSettingsBooleanValue(payload) ?? false)
    restartRuntimeHostsForEnvironmentChange()
  },
  devUpdateBranch: (payload) => setDevUpdateBranch(getSettingsBooleanValue(payload) ?? false),
  betaUpdateBranch: (payload) => setDevUpdateBranch(getSettingsBooleanValue(payload) ?? false),
  piTuiTakeover: (payload) => setPiTuiTakeover(getSettingsBooleanValue(payload) ?? false),
  hideSidebarSessionCounts: (payload) =>
    setHideSidebarSessionCounts(getSettingsBooleanValue(payload) ?? false),
  hoverToFocus: (payload) => setHoverToFocus(getSettingsBooleanValue(payload) ?? true),
  hoverToBlur: (payload) => setHoverToBlur(getSettingsBooleanValue(payload) ?? false),
  keybindings: (payload) => {
    const value = payload.value
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      setKeybindings(parseKeybindingOverrides(JSON.stringify(value)))
    }
  },
  composerSendMode: (payload) => {
    if (payload.value === 'enter' || payload.value === 'cmd-enter')
      setComposerSendMode(payload.value)
  },
  preferredProjectLocation: (payload) =>
    setPreferredProjectLocation(getSettingsPreferredProjectLocation(payload)),
  customPiDirectory: (payload) => {
    const currentCustomPiDirectory = normalizeOptionalSettingsPath(
      loadAppSettings().customPiDirectory,
    )
    const nextCustomPiDirectory = normalizeOptionalSettingsPath(
      getSettingsPreferredProjectLocation(payload),
    )
    if (currentCustomPiDirectory === nextCustomPiDirectory) return { didMutate: false }

    setCustomPiDirectory(nextCustomPiDirectory)
    restartRuntimeHostsForEnvironmentChange()
    return { didMutate: true }
  },
  initializeGitOnProjectCreate: (payload) =>
    setOptionalBooleanSetting(payload, setInitializeGitOnProjectCreate),
  projectDashboardEnabled: (payload) =>
    setOptionalBooleanSetting(payload, setProjectDashboardEnabled),
  gitOpsDefaultMode: (payload) => {
    const value = payload.value
    if (value === 'commit' || value === 'commit-push') setGitOpsDefaultMode(value)
  },
  gitDiffBaselineDefault: (payload) => {
    const value = getSettingsProjectDiffBaselineDefault(payload)
    if (value) setGitDiffBaselineDefault(value)
  },
  gitDiffFileTreeDefaultVisible: (payload) =>
    setOptionalBooleanSetting(payload, setGitDiffFileTreeDefaultVisible),
  gitDiffIncludeUntrackedDefault: (payload) =>
    setOptionalBooleanSetting(payload, setGitDiffIncludeUntrackedDefault),
  gitDiffRenderModeDefault: (payload) => {
    const value = getSettingsProjectDiffRenderModeDefault(payload)
    if (value) setGitDiffRenderModeDefault(value)
  },
  projectDeletionMode: (payload) => {
    const value = getSettingsProjectDeletionMode(payload)
    if (value) setProjectDeletionMode(value)
  },
  chatModel: (payload) => setResettableModelSelection(payload, setChatModelSelection),
  codeModel: (payload) => setResettableModelSelection(payload, setCodeModelSelection),
  chatThinkingLevel: (payload) => setResettableThinkingLevel(payload, setChatThinkingLevel),
  codeThinkingLevel: (payload) => setResettableThinkingLevel(payload, setCodeThinkingLevel),
  skillCreatorModel: (payload) =>
    setResettableModelSelection(payload, setSkillCreatorModelSelection),
  gitCommitMessageThinkingLevel: (payload) =>
    setOptionalThinkingLevel(payload, setGitCommitMessageThinkingLevel),
  skillCreatorThinkingLevel: (payload) =>
    setOptionalThinkingLevel(payload, setSkillCreatorThinkingLevel),
  smartBtwThinkingLevel: (payload) => {
    setOptionalThinkingLevel(payload, setSmartBtwThinkingLevel)
    restartRuntimeHostsForEnvironmentChange()
  },
  gitCommitMessageModel: (payload) =>
    setResettableModelSelection(payload, setGitCommitMessageModelSelection),
  smartBtwModel: (payload) => {
    setResettableModelSelection(payload, setSmartBtwModelSelection)
    restartRuntimeHostsForEnvironmentChange()
  },
} satisfies Record<string, SettingsUpdateHandler>

export async function handleSettingsDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  if (action === 'settings.clear-clipboard-images') {
    return handledAction(await clearClipboardImageTempFiles())
  }

  if (action !== 'settings.update') return unhandledAction()

  const key = getSettingsKey(payload)
  const result = key ? settingsUpdateHandlers[key]?.(payload) : undefined
  return handledAction(isSettingsUpdateResult(result) ? result : undefined)
}
