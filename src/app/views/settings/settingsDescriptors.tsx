import type { Dispatch, SetStateAction } from "react";
import type {
  AppSettings,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  DictationModelId,
  PiSettings,
} from "../../desktop/types";
import { buildCommonSettingsDescriptors } from "./settingsDescriptorCommon";
import { buildDictationSettingsDescriptors } from "./settingsDescriptorDictation";
import { buildModelSettingsDescriptors } from "./settingsDescriptorModels";
import { buildPiRuntimeSettingsDescriptors } from "./settingsDescriptorPiRuntime";
import { buildProjectsSettingsDescriptors } from "./settingsDescriptorProjects";
import type { SettingsController, SetDraftPiSetting } from "./settingsDescriptorTypes";
import type { SettingDescriptor } from "./settingsTypes";

export function buildSettingsDescriptors({
  appSettings,
  availableModels,
  availableThinkingLevels,
  currentModel,
  controller,
  draftPiSettings,
  setDraftPiSetting,
  openSelectId,
  setOpenSelectId,
  dictationModelDraft,
  setDictationModelDraft,
  configuredDictationModelId,
  onAction,
}: {
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  currentModel: ComposerModel | null;
  controller: SettingsController;
  draftPiSettings: PiSettings;
  setDraftPiSetting: SetDraftPiSetting;
  openSelectId: string | null;
  setOpenSelectId: Dispatch<SetStateAction<string | null>>;
  dictationModelDraft: DictationModelId | null;
  setDictationModelDraft: Dispatch<SetStateAction<DictationModelId | null>>;
  configuredDictationModelId: DictationModelId | null;
  onAction: DesktopActionInvoker;
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
    ...buildPiRuntimeSettingsDescriptors({ draftPiSettings, setDraftPiSetting }),
    ...buildDictationSettingsDescriptors({
      appSettings,
      controller,
      openSelectId,
      setOpenSelectId,
      dictationModelDraft,
      setDictationModelDraft,
      configuredDictationModelId,
    }),
  ];
}
