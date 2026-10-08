import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import type { AppSettings } from '../../desktop/types'
import { buildDirectoryBasicsSettingsDescriptors } from './settingsDescriptorDirectoryBasics'
import { buildGitDiffSettingsDescriptors } from './settingsDescriptorDirectoryGitDiffs'
import { buildDirectoryMaintenanceSettingsDescriptors } from './settingsDescriptorDirectoryMaintenance'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

export function buildDirectoriesSettingsDescriptors(input: {
  appSettings: AppSettings
  controller: SettingsController
}): SettingDescriptor[] {
  const codingEnabled = isToolkitComponentEnabled(input.appSettings, 'coding')
  return [
    ...buildDirectoryBasicsSettingsDescriptors(input),
    ...buildGitDiffSettingsDescriptors(input),
    ...buildDirectoryMaintenanceSettingsDescriptors(input),
  ].filter(
    (setting) =>
      codingEnabled ||
      setting.id === 'projects.custom-pi-directory' ||
      setting.id === 'projects.favorite-folders',
  )
}
