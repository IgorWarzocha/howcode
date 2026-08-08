import type { PiSettings, PiThemeState } from '../../desktop/types'
import { buildPiCoreSettingsDescriptors } from './settingsDescriptorPiCore'
import { buildPiTuiSettingsDescriptors } from './settingsDescriptorPiTui'
import type { SetDraftPiSetting } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

export function buildPiRuntimeSettingsDescriptors(input: {
  draftPiSettings: PiSettings
  piTheme: PiThemeState | null
  setDraftPiSetting: SetDraftPiSetting
  openSelectId: string | null
  setOpenSelectId: (id: string | null) => void
}): SettingDescriptor[] {
  return [
    ...buildPiCoreSettingsDescriptors(input),
    ...buildPiTuiSettingsDescriptors({
      draftPiSettings: input.draftPiSettings,
      setDraftPiSetting: input.setDraftPiSetting,
    }),
  ]
}
