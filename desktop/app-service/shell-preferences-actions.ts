import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import { refreshDurableSettings } from '../durable-runtime/host.ts'
import { importPiPreferences } from '../settings/preferences.ts'
import {
  loadPiThemeState,
  type ShellPreferencesKey,
  updateShellPreference,
} from '../shell-preferences.ts'
import { type ActionHandlerResult, handledAction, unhandledAction } from './action-router-result.ts'

const shellPreferencesKeys = new Set<ShellPreferencesKey>([
  'theme',
  'autoCompact',
  'blockImages',
  'transport',
  'steeringMode',
  'followUpMode',
])

function getShellPreferencesKey(payload: AnyDesktopActionPayload): ShellPreferencesKey | null {
  return typeof payload.shellPreferencesKey === 'string' &&
    shellPreferencesKeys.has(payload.shellPreferencesKey as ShellPreferencesKey)
    ? (payload.shellPreferencesKey as ShellPreferencesKey)
    : null
}

export async function handleShellPreferencesDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  if (action === 'shell-preferences.import-pi') {
    if (
      payload.directoryPath !== undefined &&
      (typeof payload.directoryPath !== 'string' || !payload.directoryPath.trim())
    )
      throw new Error('Pi configuration directory must not be empty.')
    const result = await importPiPreferences(
      typeof payload.directoryPath === 'string' ? payload.directoryPath : undefined,
    )
    await refreshDurableSettings()
    return handledAction({ ...result, piTheme: await loadPiThemeState() })
  }
  if (action !== 'shell-preferences.update') {
    return unhandledAction()
  }

  const key = getShellPreferencesKey(payload)
  if (!key) {
    return handledAction()
  }

  const shellPreferences = await updateShellPreference(key, payload.value)
  await refreshDurableSettings()
  if (key !== 'theme') {
    return handledAction({ shellPreferences })
  }

  const piTheme = await loadPiThemeState()
  return handledAction({ shellPreferences, piTheme })
}
