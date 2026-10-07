import type { PiSettings, ShellState } from '../desktop/types'
import type { ActionPayload } from './controller-action-utils'

function isPiSettingsKey(value: unknown): value is keyof PiSettings {
  return (
    typeof value === 'string' &&
    [
      'theme',
      'autoCompact',
      'enableSkillCommands',
      'blockImages',
      'transport',
      'steeringMode',
      'followUpMode',
    ].includes(value)
  )
}

function isValidPiSettingsStringValue(key: keyof PiSettings, value: unknown) {
  if (key === 'theme') return typeof value === 'string' && value.trim().length > 0
  if (key === 'transport')
    return (
      value === 'sse' || value === 'websocket' || value === 'websocket-cached' || value === 'auto'
    )
  if (key === 'steeringMode' || key === 'followUpMode')
    return value === 'all' || value === 'one-at-a-time'
  return true
}

function getOptimisticPiSettingsValue<Key extends keyof PiSettings>(
  key: Key,
  value: unknown,
  currentValue: PiSettings[Key],
): PiSettings[Key] | null {
  if (typeof value !== typeof currentValue) return null
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
