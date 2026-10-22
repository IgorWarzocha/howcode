import { buildDirectorySettingsDescriptors } from '@howcode/components/working-directories/ui'
import type { Dispatch, SetStateAction } from 'react'
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  PiThemeState,
  ShellPreferences,
} from '../../desktop/types'
import { buildCommonSettingsDescriptors } from './settingsDescriptorCommon'
import { buildComponentSettingsDescriptors } from './settingsDescriptorComponents'
import { buildDictationSettingsDescriptor } from './settingsDescriptorDictation'
import { buildGeneralPathsSettingsDescriptors } from './settingsDescriptorGeneralPaths'
import { buildKeybindingSettingsDescriptors } from './settingsDescriptorKeybindings'
import { buildModelSettingsDescriptors } from './settingsDescriptorModels'
import { buildNavigationSettingsDescriptor } from './settingsDescriptorNavigation'
import { buildRuntimeSettingsDescriptors } from './settingsDescriptorRuntime'
import type { SetDraftShellPreference, SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

export function buildSettingsDescriptors({
  appSettings,
  availableModels,
  availableThinkingLevels,
  currentModel,
  controller,
  draftShellPreferences,
  piTheme,
  setDraftShellPreference,
  openSelectId,
  setOpenSelectId,
  onAction,
  installedSettings,
}: {
  appSettings: AppSettings
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  controller: SettingsController
  draftShellPreferences: ShellPreferences
  piTheme: PiThemeState | null
  setDraftShellPreference: SetDraftShellPreference
  openSelectId: string | null
  setOpenSelectId: Dispatch<SetStateAction<string | null>>
  onAction: DesktopActionInvoker
  installedSettings: SettingDescriptor[]
}): SettingDescriptor[] {
  return [
    ...installedSettings,
    buildNavigationSettingsDescriptor({ appSettings, controller, openSelectId, setOpenSelectId }),
    buildDictationSettingsDescriptor({ controller, openSelectId, setOpenSelectId }),
    ...buildComponentSettingsDescriptors(appSettings, onAction),
    ...buildCommonSettingsDescriptors({ appSettings, controller }),
    ...buildGeneralPathsSettingsDescriptors({ appSettings, controller }),
    ...buildDirectorySettingsDescriptors({ appSettings, controller }),
    ...buildModelSettingsDescriptors({
      appSettings,
      availableModels,
      availableThinkingLevels,
      currentModel,
      controller,
      openSelectId,
      setOpenSelectId,
      onAction,
    }),
    ...buildRuntimeSettingsDescriptors({
      draftShellPreferences,
      piTheme,
      setDraftShellPreference,
      openSelectId,
      setOpenSelectId,
    }),
    ...buildKeybindingSettingsDescriptors({
      appSettings,
      openSelectId,
      setOpenSelectId,
      onAction,
    }),
  ]
}
