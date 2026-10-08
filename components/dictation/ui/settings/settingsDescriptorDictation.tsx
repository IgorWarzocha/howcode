import { composerTextActionButtonClass } from '@howaboua/howcode-sdk/ui/classes'
import { appToneDangerClass, appTypeSmallClass } from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import {
  DEFAULT_DICTATION_MAX_DURATION_SECONDS,
  DICTATION_MAX_DURATION_OPTIONS,
} from '@howcode/shared/dictation-settings'
import { settingsInputClass } from '@howcode/ui/classes'
import { Download, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { ActivitySpinner } from '../../../../src/app/common/activity-spinner'
import type { AppSettings, DictationModelId } from '../../../../src/app/desktop/types'
import type { useSettingsDictationController } from './useSettingsDictationController'

type SettingsController = { dictation: ReturnType<typeof useSettingsDictationController> }

import type { SettingDescriptor } from '../../../../src/app/settings/settings/settingsTypes'
import { InlineSelect, ToggleBox } from '../../../../src/app/settings/settings/settingsUi'
import { normalizeManagedDictationModelId } from './settingsDictationHelpers'

function DictationModelSettingControl({
  controller,
  dictationModelSelectValue,
  dictationPendingForSelectedModel,
  openSelectId,
  removableDictationModel,
  selectedDictationOptionIsInstalled,
  selectedDictationOptionModel,
  setDictationModelDraft,
  setOpenSelectId,
}: {
  controller: SettingsController['dictation']
  dictationModelSelectValue: string
  dictationPendingForSelectedModel: 'download' | 'switch' | 'delete' | null
  openSelectId: string | null
  removableDictationModel: NonNullable<
    ReturnType<typeof normalizeManagedDictationModelId>
  > extends never
    ? never
    : (typeof controller.dictationModels)[number] | null
  selectedDictationOptionIsInstalled: boolean
  selectedDictationOptionModel: (typeof controller.dictationModels)[number] | null
  setDictationModelDraft: Dispatch<SetStateAction<DictationModelId | null>>
  setOpenSelectId: Dispatch<SetStateAction<string | null>>
}) {
  const handleModelChange = (value: string) => {
    const modelId = normalizeManagedDictationModelId(value)
    if (!modelId) return
    setDictationModelDraft(modelId)
    const model = controller.dictationModels.find((candidate) => candidate.id === modelId)
    if (model?.installed) controller.setDictationModelId(modelId)
  }

  return (
    <div className="grid w-[27rem] max-w-full gap-1.5">
      <div className="flex items-center justify-end gap-2">
        <InlineSelect
          id="dictation-model"
          className="min-w-0"
          value={dictationModelSelectValue}
          open={openSelectId === 'dictation-model'}
          options={controller.dictationModels.map((model) => ({
            value: model.id,
            label: `${model.name} · ${model.downloadSizeLabel}`,
          }))}
          onOpenChange={(open) => setOpenSelectId(open ? 'dictation-model' : null)}
          onChange={handleModelChange}
        />
        {selectedDictationOptionModel && !selectedDictationOptionIsInstalled ? (
          <button
            type="button"
            className={cn(composerTextActionButtonClass, 'h-8 justify-center')}
            disabled={controller.dictationPendingAction !== null}
            onClick={() => controller.installDictationModel(selectedDictationOptionModel.id)}
          >
            {dictationPendingForSelectedModel === 'download' ? (
              <ActivitySpinner className="h-3 w-3 text-current" />
            ) : (
              <Download size={12} />
            )}
            <span>
              {dictationPendingForSelectedModel === 'download' ? 'Downloading…' : 'Download'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className={cn(composerTextActionButtonClass, 'h-8 justify-center')}
            disabled={controller.dictationPendingAction !== null || !removableDictationModel}
            onClick={() =>
              removableDictationModel && controller.deleteDictationModel(removableDictationModel.id)
            }
          >
            {controller.dictationPendingAction?.kind === 'delete' ? (
              <ActivitySpinner className="h-3 w-3 text-current" />
            ) : (
              <Trash2 size={12} />
            )}
            <span>
              {controller.dictationPendingAction?.kind === 'delete' ? 'Removing…' : 'Remove'}
            </span>
          </button>
        )}
      </div>
      {controller.dictationInstallError ? (
        <output className={`${appTypeSmallClass} ${appToneDangerClass}`} aria-live="polite">
          {controller.dictationInstallError}
        </output>
      ) : null}
    </div>
  )
}

export function buildDictationSettingsDescriptors({
  appSettings,
  controller,
  openSelectId,
  setOpenSelectId,
  dictationModelDraft,
  setDictationModelDraft,
  configuredDictationModelId,
}: {
  appSettings: AppSettings
  controller: SettingsController
  openSelectId: string | null
  setOpenSelectId: Dispatch<SetStateAction<string | null>>
  dictationModelDraft: DictationModelId | null
  setDictationModelDraft: Dispatch<SetStateAction<DictationModelId | null>>
  configuredDictationModelId: DictationModelId | null
}): SettingDescriptor[] {
  const dictationModelSelectValue =
    dictationModelDraft ??
    configuredDictationModelId ??
    controller.dictation.dictationModels[0]?.id ??
    ''
  const selectedDictationOptionModel =
    controller.dictation.dictationModels.find((model) => model.id === dictationModelSelectValue) ??
    null
  const selectedDictationOptionIsInstalled = Boolean(selectedDictationOptionModel?.installed)
  const removableDictationModel =
    selectedDictationOptionModel?.installed && selectedDictationOptionModel.managed
      ? selectedDictationOptionModel
      : null
  const dictationPendingForSelectedModel =
    selectedDictationOptionModel &&
    controller.dictation.dictationPendingAction?.modelId === selectedDictationOptionModel.id
      ? controller.dictation.dictationPendingAction.kind
      : null

  return [
    {
      id: 'dictation.models',
      category: 'dictation',
      title: 'Speech-to-text model',
      description: 'Dictation model selection.',
      keywords: 'dictation model whisper download tiny base small speech transcription',
      render: () => (
        <DictationModelSettingControl
          controller={controller.dictation}
          dictationModelSelectValue={dictationModelSelectValue}
          dictationPendingForSelectedModel={dictationPendingForSelectedModel}
          openSelectId={openSelectId}
          removableDictationModel={removableDictationModel}
          selectedDictationOptionIsInstalled={selectedDictationOptionIsInstalled}
          selectedDictationOptionModel={selectedDictationOptionModel}
          setDictationModelDraft={setDictationModelDraft}
          setOpenSelectId={setOpenSelectId}
        />
      ),
    },
    {
      id: 'dictation.max-duration',
      category: 'dictation',
      title: 'Max dictation length',
      description: `Safety net in case you forget. Default is ${DEFAULT_DICTATION_MAX_DURATION_SECONDS / 60} minutes.`,
      keywords: 'dictation duration length capture minutes seconds',
      render: () => (
        <select
          className={cn(settingsInputClass, 'w-36')}
          value={String(appSettings.dictationMaxDurationSeconds)}
          onChange={(event) =>
            controller.dictation.setDictationMaxDurationSeconds(
              Number.parseInt(event.target.value, 10),
            )
          }
          aria-label="Max dictation length"
        >
          {DICTATION_MAX_DURATION_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minutes`}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: 'dictation.show-button',
      category: 'dictation',
      title: 'Toggle dictation',
      description: 'Hide if you have a preferred dictation system.',
      keywords: 'dictation button composer microphone show hide',
      render: () => (
        <ToggleBox
          checked={appSettings.showDictationButton}
          label="Toggle dictation"
          onClick={() =>
            controller.dictation.setShowDictationButton(!appSettings.showDictationButton)
          }
        />
      ),
    },
  ]
}
