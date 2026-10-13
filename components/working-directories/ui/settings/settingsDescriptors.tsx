import type { AppSettings } from '@howcode/desktop/types'
import type { SettingDescriptor } from '@howcode/settings/settingsTypes'
import { buildDirectoryBasicsSettingsDescriptors } from './settingsDescriptorDirectoryBasics'
import { buildDirectoryMaintenanceSettingsDescriptors } from './settingsDescriptorDirectoryMaintenance'
import type { DirectorySettingsController } from './useDirectorySettingsController'

export function buildDirectorySettingsDescriptors(input: {
  appSettings: AppSettings
  controller: { directories: DirectorySettingsController }
}): SettingDescriptor[] {
  return [
    ...buildDirectoryBasicsSettingsDescriptors(input),
    ...buildDirectoryMaintenanceSettingsDescriptors(input),
  ]
}
