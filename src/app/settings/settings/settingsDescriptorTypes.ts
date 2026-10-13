import type { ShellPreferences } from '../../desktop/types'
import type { useSettingsController } from './useSettingsController'

export type SettingsController = ReturnType<typeof useSettingsController>
export type SetDraftShellPreference = <Key extends keyof ShellPreferences>(
  key: Key,
  value: ShellPreferences[Key],
) => void
