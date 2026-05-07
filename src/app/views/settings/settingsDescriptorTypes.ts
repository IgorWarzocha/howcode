import type { PiSettings } from '../../desktop/types'
import type { useSettingsController } from './useSettingsController'

export type SettingsController = ReturnType<typeof useSettingsController>
export type SetDraftPiSetting = <Key extends keyof PiSettings>(
  key: Key,
  value: PiSettings[Key],
) => void
