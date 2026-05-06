import type { PiSettings, PiThemeState } from '../shared/desktop-contracts.ts'
import { invalidateRuntimeHostSettings, invokeRuntimeHost } from './runtime-host/client-bridge.ts'

export type PiSettingsKey = keyof PiSettings

export function loadPiSettings(
  projectPath?: string | undefined | null | undefined,
): Promise<PiSettings> {
  return invokeRuntimeHost('loadPiSettings', {
    projectPath: projectPath ?? null,
  })
}

export function loadPiThemeState(
  projectPath?: string | undefined | null | undefined,
): Promise<PiThemeState> {
  return invokeRuntimeHost('loadPiThemeState', {
    projectPath: projectPath ?? null,
  })
}

export async function updatePiSetting(
  key: PiSettingsKey,
  value: unknown,
  projectPath?: string | undefined | null | undefined,
): Promise<PiSettings> {
  const settings = await invokeRuntimeHost('updatePiSetting', {
    key,
    value,
    projectPath: projectPath ?? null,
  })
  await invalidateRuntimeHostSettings({ projectPath: projectPath ?? null })
  return settings
}
