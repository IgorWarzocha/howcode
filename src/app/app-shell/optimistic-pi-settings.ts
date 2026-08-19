import type { PiSettings, ShellState } from '../desktop/types'
import type { ActionPayload } from './controller-action-utils'

function isPiSettingsKey(value: unknown): value is keyof PiSettings {
  return (
    typeof value === 'string' &&
    [
      'theme',
      'autoCompact',
      'enableSkillCommands',
      'hideThinkingBlock',
      'quietStartup',
      'showImages',
      'autoResizeImages',
      'blockImages',
      'collapseChangelog',
      'enableInstallTelemetry',
      'showHardwareCursor',
      'clearOnShrink',
      'transport',
      'steeringMode',
      'followUpMode',
      'doubleEscapeAction',
      'defaultProjectTrust',
      'treeFilterMode',
      'editorPaddingX',
      'autocompleteMaxVisible',
      'imageWidthCells',
    ].includes(value)
  )
}

function getNumericPiSettingsValue<Key extends keyof PiSettings>(key: Key, value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const [min, max] =
    key === 'editorPaddingX' ? [0, 3] : key === 'autocompleteMaxVisible' ? [3, 20] : [1, 200]
  return Math.max(min, Math.min(max, Math.floor(value))) as PiSettings[Key]
}

function isValidPiSettingsStringValue(key: keyof PiSettings, value: unknown) {
  if (key === 'theme') return typeof value === 'string' && value.trim().length > 0
  if (key === 'transport') return value === 'sse' || value === 'websocket' || value === 'auto'
  if (key === 'steeringMode' || key === 'followUpMode')
    return value === 'all' || value === 'one-at-a-time'
  if (key === 'doubleEscapeAction') return value === 'fork' || value === 'tree' || value === 'none'
  if (key === 'defaultProjectTrust')
    return value === 'ask' || value === 'always' || value === 'never'
  if (key === 'treeFilterMode')
    return ['default', 'no-tools', 'user-only', 'labeled-only', 'all'].includes(String(value))
  return true
}

function getOptimisticPiSettingsValue<Key extends keyof PiSettings>(
  key: Key,
  value: unknown,
  currentValue: PiSettings[Key],
): PiSettings[Key] | null {
  if (typeof value !== typeof currentValue) return null
  if (key === 'editorPaddingX' || key === 'autocompleteMaxVisible' || key === 'imageWidthCells') {
    return getNumericPiSettingsValue(key, value)
  }
  if (!isValidPiSettingsStringValue(key, value)) return null
  return key === 'theme' ? (String(value).trim() as PiSettings[Key]) : (value as PiSettings[Key])
}

export function getOptimisticallyUpdatedPiSettingsState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!(currentState && isPiSettingsKey(payload.piSettingsKey))) {
    return currentState
  }

  const currentValue = currentState.piSettings[payload.piSettingsKey]
  const nextValue = getOptimisticPiSettingsValue(payload.piSettingsKey, payload.value, currentValue)
  if (nextValue === null) {
    return currentState
  }

  return {
    ...currentState,
    piSettings: {
      ...currentState.piSettings,
      [payload.piSettingsKey]: nextValue,
    },
  } satisfies ShellState
}
