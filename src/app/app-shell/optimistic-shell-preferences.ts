import type { ShellPreferences, ShellState } from '../desktop/types'
import type { ActionPayload } from './controller-action-utils'

function isShellPreferencesKey(value: unknown): value is keyof ShellPreferences {
  return (
    typeof value === 'string' &&
    ['theme', 'autoCompact', 'blockImages', 'transport', 'steeringMode', 'followUpMode'].includes(
      value,
    )
  )
}

function isValidShellPreferencesStringValue(key: keyof ShellPreferences, value: unknown) {
  if (key === 'theme') return typeof value === 'string' && value.trim().length > 0
  if (key === 'transport')
    return (
      value === 'sse' || value === 'websocket' || value === 'websocket-cached' || value === 'auto'
    )
  if (key === 'steeringMode' || key === 'followUpMode')
    return value === 'all' || value === 'one-at-a-time'
  return true
}

function getOptimisticShellPreferencesValue<Key extends keyof ShellPreferences>(
  key: Key,
  value: unknown,
  currentValue: ShellPreferences[Key],
): ShellPreferences[Key] | null {
  if (typeof value !== typeof currentValue) return null
  if (!isValidShellPreferencesStringValue(key, value)) return null
  return key === 'theme'
    ? (String(value).trim() as ShellPreferences[Key])
    : (value as ShellPreferences[Key])
}

export function getOptimisticallyUpdatedShellPreferencesState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!(currentState && isShellPreferencesKey(payload.shellPreferencesKey))) {
    return currentState
  }

  const currentValue = currentState.shellPreferences[payload.shellPreferencesKey]
  const nextValue = getOptimisticShellPreferencesValue(
    payload.shellPreferencesKey,
    payload.value,
    currentValue,
  )
  if (nextValue === null) {
    return currentState
  }

  return {
    ...currentState,
    shellPreferences: {
      ...currentState.shellPreferences,
      [payload.shellPreferencesKey]: nextValue,
    },
  } satisfies ShellState
}
