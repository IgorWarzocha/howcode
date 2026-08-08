import type { AppSettings } from '../../desktop/types'
import { buildProjectBasicsSettingsDescriptors } from './settingsDescriptorProjectBasics'
import { buildGitDiffSettingsDescriptors } from './settingsDescriptorProjectGitDiffs'
import { buildProjectMaintenanceSettingsDescriptors } from './settingsDescriptorProjectMaintenance'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

export function buildProjectsSettingsDescriptors(input: {
  appSettings: AppSettings
  controller: SettingsController
}): SettingDescriptor[] {
  return [
    ...buildProjectBasicsSettingsDescriptors(input),
    ...buildGitDiffSettingsDescriptors(input),
    ...buildProjectMaintenanceSettingsDescriptors(input),
  ]
}
