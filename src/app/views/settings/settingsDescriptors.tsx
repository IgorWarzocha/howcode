import type { Dispatch, SetStateAction } from 'react'
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  DictationModelId,
  PiSettings,
  PiThemeState,
} from '../../desktop/types'
import { buildCommonSettingsDescriptors } from './settingsDescriptorCommon'
import { buildDictationSettingsDescriptors } from './settingsDescriptorDictation'
import { buildModelSettingsDescriptors } from './settingsDescriptorModels'
import { buildPiRuntimeSettingsDescriptors } from './settingsDescriptorPiRuntime'
import { buildProjectsSettingsDescriptors } from './settingsDescriptorProjects'
import type { SetDraftPiSetting, SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

export function buildSettingsDescriptors({
  appSettings,
  availableModels,
  availableThinkingLevels,
  currentModel,
  controller,
  draftPiSettings,
  piTheme,
  setDraftPiSetting,
  openSelectId,
  setOpenSelectId,
  dictationModelDraft,
  setDictationModelDraft,
  configuredDictationModelId,
  onAction,
}: {
  appSettings: AppSettings
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  currentModel: ComposerModel | null
  controller: SettingsController
  draftPiSettings: PiSettings
  piTheme: PiThemeState | null
  setDraftPiSetting: SetDraftPiSetting
  openSelectId: string | null
  setOpenSelectId: Dispatch<SetStateAction<string | null>>
  dictationModelDraft: DictationModelId | null
  setDictationModelDraft: Dispatch<SetStateAction<DictationModelId | null>>
  configuredDictationModelId: DictationModelId | null
  onAction: DesktopActionInvoker
}): SettingDescriptor[] {
  return [
    ...buildProjectsSettingsDescriptors({ appSettings, controller }),
    ...buildCommonSettingsDescriptors({ appSettings, controller }),
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
    ...buildPiRuntimeSettingsDescriptors({
      draftPiSettings,
      piTheme,
      setDraftPiSetting,
      openSelectId,
      setOpenSelectId,
    }),
    ...buildDictationSettingsDescriptors({
      appSettings,
      controller,
      openSelectId,
      setOpenSelectId,
      dictationModelDraft,
      setDictationModelDraft,
      configuredDictationModelId,
    }),
  ]
}
