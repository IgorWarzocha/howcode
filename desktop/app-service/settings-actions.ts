import {
  getSettingsBooleanValue,
  getSettingsComposerStreamingBehavior,
  getSettingsDictationModelId,
  getSettingsDirectoryDeletionMode,
  getSettingsDirectoryDiffBaselineDefault,
  getSettingsDirectoryDiffRenderModeDefault,
  getSettingsDirectoryImportState,
  getSettingsFavoriteFolders,
  getSettingsKey,
  getSettingsModelSelection,
  getSettingsNumberValue,
  getSettingsPreferredDirectoryLocation,
  getSettingsReset,
  getSettingsThinkingLevel,
  getSettingsToolkitComponents,
} from '../../shared/desktop-action-payloads.ts'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
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
  setDictationMaxDurationSeconds,
  setDictationModelId,
  setDirectoryDashboardEnabled,
  setDirectoryDeletionMode,
  setDirectoryImportState,
  setEnabledToolkitComponents,
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
  setInitializeGitOnDirectoryCreate,
  setKeybindings,
  setPreferredDirectoryLocation,
  setShowDictationButton,
  setUseAgentsSkillsPaths,
} from '../app-settings/writers.ts'
import { refreshDurableSettings } from '../durable-runtime/host.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'

type SettingsUpdateHandler = (payload: AnyDesktopActionPayload) => unknown | Promise<unknown>

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
  enabledToolkitComponents: (payload) =>
    setEnabledToolkitComponents(getSettingsToolkitComponents(payload)),
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
  directoryImportState: (payload) =>
    setDirectoryImportState(getSettingsDirectoryImportState(payload)),
  useAgentsSkillsPaths: (payload) =>
    setUseAgentsSkillsPaths(getSettingsBooleanValue(payload) ?? false),

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
  preferredDirectoryLocation: (payload) =>
    setPreferredDirectoryLocation(getSettingsPreferredDirectoryLocation(payload)),
  customPiDirectory: async (payload) => {
    const currentCustomPiDirectory = normalizeOptionalSettingsPath(
      loadAppSettings().customPiDirectory,
    )
    const nextCustomPiDirectory = normalizeOptionalSettingsPath(
      getSettingsPreferredDirectoryLocation(payload),
    )
    if (currentCustomPiDirectory === nextCustomPiDirectory) return { didMutate: false }

    setCustomPiDirectory(nextCustomPiDirectory)
    await refreshDurableSettings()
    return { didMutate: true }
  },
  initializeGitOnDirectoryCreate: (payload) =>
    setOptionalBooleanSetting(payload, setInitializeGitOnDirectoryCreate),
  directoryDashboardEnabled: (payload) =>
    setOptionalBooleanSetting(payload, setDirectoryDashboardEnabled),
  gitOpsDefaultMode: (payload) => {
    const value = payload.value
    if (value === 'commit' || value === 'commit-push') setGitOpsDefaultMode(value)
  },
  gitDiffBaselineDefault: (payload) => {
    const value = getSettingsDirectoryDiffBaselineDefault(payload)
    if (value) setGitDiffBaselineDefault(value)
  },
  gitDiffFileTreeDefaultVisible: (payload) =>
    setOptionalBooleanSetting(payload, setGitDiffFileTreeDefaultVisible),
  gitDiffIncludeUntrackedDefault: (payload) =>
    setOptionalBooleanSetting(payload, setGitDiffIncludeUntrackedDefault),
  gitDiffRenderModeDefault: (payload) => {
    const value = getSettingsDirectoryDiffRenderModeDefault(payload)
    if (value) setGitDiffRenderModeDefault(value)
  },
  directoryDeletionMode: (payload) => {
    const value = getSettingsDirectoryDeletionMode(payload)
    if (value) setDirectoryDeletionMode(value)
  },
  chatModel: (payload) => setResettableModelSelection(payload, setChatModelSelection),
  codeModel: (payload) => setResettableModelSelection(payload, setCodeModelSelection),
  chatThinkingLevel: (payload) => setResettableThinkingLevel(payload, setChatThinkingLevel),
  codeThinkingLevel: (payload) => setResettableThinkingLevel(payload, setCodeThinkingLevel),
  gitCommitMessageThinkingLevel: (payload) =>
    setOptionalThinkingLevel(payload, setGitCommitMessageThinkingLevel),
  gitCommitMessageModel: (payload) =>
    setResettableModelSelection(payload, setGitCommitMessageModelSelection),
} satisfies Record<string, SettingsUpdateHandler>

export async function handleSettingsDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  if (action !== 'settings.update') return unhandledAction()

  const key = getSettingsKey(payload)
  const result = key ? await settingsUpdateHandlers[key]?.(payload) : undefined
  return handledAction(isSettingsUpdateResult(result) ? result : undefined)
}
