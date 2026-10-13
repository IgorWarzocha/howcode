import { isComposerThinkingLevel } from '@howcode/shared/composer-thinking-level'
import { getSettingsToolkitComponents } from '@howcode/shared/desktop-action-payloads'
import {
  isKeybindingCommandId,
  isValidAccelerator,
  normalizeAccelerator,
} from '@howcode/shared/keybindings'
import type { ComposerThinkingLevel, ModelSelection, ShellState } from '../desktop/types'
import { getGitRendererApi } from '../git-integration/client'
import type { ActionPayload } from './controller-action-utils'

const optimisticSettingKeys = new Set([
  'enabledToolkitComponents',
  'chatModel',
  'chatThinkingLevel',
  'codeModel',
  'codeThinkingLevel',
  'composerStreamingBehavior',
  'favoriteFolders',
  'directoryImportState',
  'preferredDirectoryLocation',
  'customPiDirectory',
  'initializeGitOnDirectoryCreate',
  'directoryDashboardEnabled',
  'directoryDeletionMode',
  'useAgentsSkillsPaths',
  'hideSidebarSessionCounts',
  'navigationRenderer',
  'hoverToFocus',
  'hoverToBlur',
  'keybindings',
  'composerSendMode',
])

function getOptimisticModelSelection(
  payload: ActionPayload,
  fallback: ModelSelection | null,
): ModelSelection | null {
  if (payload.reset === true) return null
  return typeof payload.provider === 'string' && typeof payload.modelId === 'string'
    ? { provider: payload.provider, id: payload.modelId }
    : fallback
}

function getOptimisticFavoriteFolders(payload: ActionPayload, fallback: string[]) {
  return Array.isArray(payload.folders)
    ? [
        ...new Set(
          payload.folders.flatMap((folder) => {
            if (typeof folder !== 'string') return []
            const trimmed = folder.trim()
            return trimmed ? [trimmed] : []
          }),
        ),
      ]
    : fallback
}

function applyOptimisticModelSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (payload.key === 'chatModel')
    nextSettings.chatModel = getOptimisticModelSelection(payload, nextSettings.chatModel)
  if (payload.key === 'codeModel')
    nextSettings.codeModel = getOptimisticModelSelection(payload, nextSettings.codeModel)
}

function getResettableThinkingLevel(
  payload: ActionPayload,
  fallback: ComposerThinkingLevel | null,
) {
  if (payload.reset === true) return null
  return isComposerThinkingLevel(payload.value) ? payload.value : fallback
}

function applyOptimisticThinkingSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (payload.key === 'chatThinkingLevel') {
    nextSettings.chatThinkingLevel = getResettableThinkingLevel(
      payload,
      nextSettings.chatThinkingLevel,
    )
  }
  if (payload.key === 'codeThinkingLevel') {
    nextSettings.codeThinkingLevel = getResettableThinkingLevel(
      payload,
      nextSettings.codeThinkingLevel,
    )
  }
}

function applyOptimisticBooleanSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (typeof payload.value !== 'boolean') return
  const directBooleanKeys = [
    'initializeGitOnDirectoryCreate',
    'directoryDashboardEnabled',
    'useAgentsSkillsPaths',
  ] as const
  if (directBooleanKeys.includes(payload.key as (typeof directBooleanKeys)[number])) {
    nextSettings[payload.key as (typeof directBooleanKeys)[number]] = payload.value
  }
  if (payload.key === 'hideSidebarSessionCounts')
    nextSettings.hideSidebarSessionCounts = payload.value
  if (payload.key === 'hoverToFocus') nextSettings.hoverToFocus = payload.value
  if (payload.key === 'hoverToBlur') nextSettings.hoverToBlur = payload.value
}

function applyOptimisticKeybindingSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (
    payload.key === 'composerSendMode' &&
    (payload.value === 'enter' || payload.value === 'cmd-enter')
  ) {
    nextSettings.composerSendMode = payload.value
  }
  if (payload.key === 'keybindings') nextSettings.keybindings = getOptimisticKeybindings(payload)
}

function getOptimisticKeybindings(
  payload: ActionPayload,
): ShellState['appSettings']['keybindings'] {
  if (!(payload.value && typeof payload.value === 'object' && !Array.isArray(payload.value)))
    return {}
  const overrides: ShellState['appSettings']['keybindings'] = {}
  for (const [key, value] of Object.entries(payload.value)) {
    if (!isKeybindingCommandId(key)) continue
    if (value === null) overrides[key] = null
    else if (typeof value === 'string' && isValidAccelerator(value)) {
      overrides[key] = normalizeAccelerator(value)
    }
  }
  return overrides
}

function applyOptimisticComposerSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (
    payload.key === 'composerStreamingBehavior' &&
    (payload.value === 'steer' || payload.value === 'followUp' || payload.value === 'stop')
  )
    nextSettings.composerStreamingBehavior = payload.value
}

function applyOptimisticScalarSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  applyOptimisticComposerSetting(nextSettings, payload)
  if (payload.key === 'navigationRenderer' && typeof payload.value === 'string')
    nextSettings.navigationRenderer = payload.value
  if (payload.key === 'favoriteFolders')
    nextSettings.favoriteFolders = getOptimisticFavoriteFolders(
      payload,
      nextSettings.favoriteFolders,
    )
  if (
    payload.key === 'directoryImportState' &&
    (payload.imported === null || typeof payload.imported === 'boolean')
  )
    nextSettings.directoryImportState = payload.imported
  if (payload.key === 'preferredDirectoryLocation')
    nextSettings.preferredDirectoryLocation =
      typeof payload.value === 'string' ? payload.value.trim() || null : null
  if (payload.key === 'customPiDirectory')
    nextSettings.customPiDirectory =
      typeof payload.value === 'string' ? payload.value.trim() || null : null
}

export function getOptimisticallyUpdatedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) return currentState
  const gitPatch = getGitRendererApi()?.getOptimisticGitSettingsPatch(
    currentState.appSettings,
    payload,
  )
  if (!(optimisticSettingKeys.has(String(payload.key)) || gitPatch)) return currentState

  const appSettings = { ...currentState.appSettings }
  if (payload.key === 'enabledToolkitComponents')
    appSettings.enabledToolkitComponents = getSettingsToolkitComponents(payload)
  applyOptimisticModelSetting(appSettings, payload)
  applyOptimisticThinkingSetting(appSettings, payload)
  applyOptimisticBooleanSetting(appSettings, payload)
  applyOptimisticScalarSetting(appSettings, payload)
  if (gitPatch) Object.assign(appSettings, gitPatch)
  if (
    payload.key === 'directoryDeletionMode' &&
    (payload.value === 'pi-only' || payload.value === 'full-clean')
  )
    appSettings.directoryDeletionMode = payload.value
  applyOptimisticKeybindingSetting(appSettings, payload)

  return { ...currentState, appSettings } satisfies ShellState
}
