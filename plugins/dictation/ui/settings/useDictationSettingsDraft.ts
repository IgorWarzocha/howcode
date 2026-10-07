import { type Dispatch, type SetStateAction, useCallback, useState } from 'react'
import type { AppSettings, DictationModelId } from '../../../../src/app/desktop/types'
import { normalizeManagedDictationModelId } from './settingsDictationHelpers'

export function useDictationSettingsDraft(appSettings: AppSettings) {
  const configuredDictationModelId = normalizeManagedDictationModelId(appSettings.dictationModelId)
  const [dictationModelEdit, setDictationModelEdit] = useState<{
    source: DictationModelId | null
    value: DictationModelId | null
  } | null>(null)
  const dictationModelDraft =
    dictationModelEdit?.source === configuredDictationModelId
      ? dictationModelEdit.value
      : configuredDictationModelId
  const setDictationModelDraft: Dispatch<SetStateAction<DictationModelId | null>> = useCallback(
    (value) => {
      setDictationModelEdit((current) => {
        const currentValue =
          current?.source === configuredDictationModelId
            ? current.value
            : configuredDictationModelId
        return {
          source: configuredDictationModelId,
          value: typeof value === 'function' ? value(currentValue) : value,
        }
      })
    },
    [configuredDictationModelId],
  )

  return { configuredDictationModelId, dictationModelDraft, setDictationModelDraft }
}
