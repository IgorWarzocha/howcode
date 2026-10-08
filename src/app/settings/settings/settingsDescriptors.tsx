import { buildDictationSettingsDescriptors } from '@howcode/components/dictation/ui'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
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
import { buildComponentSettingsDescriptors } from './settingsDescriptorComponents'
import { buildDirectoriesSettingsDescriptors } from './settingsDescriptorDirectories'
import { buildKeybindingSettingsDescriptors } from './settingsDescriptorKeybindings'
import { buildModelSettingsDescriptors } from './settingsDescriptorModels'
import { buildPiRuntimeSettingsDescriptors } from './settingsDescriptorPiRuntime'
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
    ...buildComponentSettingsDescriptors(appSettings, onAction),
    ...buildCommonSettingsDescriptors({ appSettings, controller }),
    ...buildDirectoriesSettingsDescriptors({ appSettings, controller }),
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
    ...(isToolkitComponentEnabled(appSettings, 'dictation')
      ? buildDictationSettingsDescriptors({
          appSettings,
          controller,
          openSelectId,
          setOpenSelectId,
          dictationModelDraft,
          setDictationModelDraft,
          configuredDictationModelId,
        })
      : []),
    ...buildKeybindingSettingsDescriptors({
      appSettings,
      openSelectId,
      setOpenSelectId,
      onAction,
    }),
  ]
}
