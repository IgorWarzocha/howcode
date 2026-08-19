import { useCallback, useEffect, useState } from 'react'
import { getDesktopActionErrorMessage } from '../../desktop/action-results'
import type {
  AppSettings,
  DesktopActionInvoker,
  DesktopEvent,
  DictationModelId,
  DictationModelSummary,
  DictationState,
} from '../../desktop/types'
import {
  getDictationStateQuery,
  installDictationModelQuery,
  listDictationModelsQuery,
  removeDictationModelQuery,
  subscribeDesktopEvents,
} from '../../query/desktop-query'

export type DictationPendingAction = {
  modelId: DictationModelId
  kind: 'download' | 'switch' | 'delete'
}

function normalizeManagedDictationModelId(
  modelId: string | null | undefined,
): DictationModelId | null {
  return modelId === 'tiny.en' || modelId === 'base.en' || modelId === 'small.en' ? modelId : null
}

async function refreshAfterDictationError(input: {
  error: unknown
  fallbackMessage: string
  refreshDictationState: () => Promise<unknown>
  setDictationInstallError: (message: string | null) => void
}) {
  input.setDictationInstallError(
    input.error instanceof Error ? input.error.message : input.fallbackMessage,
  )
  await input.refreshDictationState()
}

async function clearSelectedDictationModelIfDeleted(input: {
  activeModelId: DictationModelId | null
  modelId: DictationModelId
  refreshDictationState: () => Promise<{ dictationModels: DictationModelSummary[] }>
  updateDictationModelSetting: (
    modelId: DictationModelId | null,
    fallbackMessage: string,
  ) => Promise<void>
}) {
  if (input.activeModelId !== input.modelId) return
  const refreshedState = await input.refreshDictationState()
  const modelStillInstalled = refreshedState.dictationModels.some(
    (model) => model.id === input.modelId && model.installed,
  )
  if (!modelStillInstalled) {
    await input.updateDictationModelSetting(null, 'Could not clear dictation model selection.')
  }
}

export function useSettingsDictationController({
  appSettings,
  onAction,
}: {
  appSettings: AppSettings
  onAction: DesktopActionInvoker
}) {
  const [dictationState, setDictationState] = useState<DictationState | null>(null)
  const [dictationModels, setDictationModels] = useState<DictationModelSummary[]>([])
  const [dictationPendingAction, setDictationPendingAction] =
    useState<DictationPendingAction | null>(null)
  const [dictationInstallError, setDictationInstallError] = useState<string | null>(null)

  useEffect(() => {
    if (!appSettings.dictationModelId) {
      return
    }

    setDictationModels((current) =>
      current.map((model) => ({
        ...model,
        selected: model.installed && model.id === appSettings.dictationModelId,
      })),
    )
  }, [appSettings.dictationModelId])

  const refreshDictationState = useCallback(async () => {
    const [nextDictationState, nextDictationModels] = await Promise.all([
      getDictationStateQuery(),
      listDictationModelsQuery(),
    ])

    setDictationState(nextDictationState)
    setDictationModels(nextDictationModels)

    return {
      dictationState: nextDictationState,
      dictationModels: nextDictationModels,
    }
  }, [])

  useEffect(() => {
    void refreshDictationState()
  }, [refreshDictationState])

  useEffect(() => {
    return subscribeDesktopEvents((event: DesktopEvent) => {
      if (event.type !== 'dictation-download-log') {
        return
      }

      if (event.done) {
        void refreshDictationState()
      }
    })
  }, [refreshDictationState])

  const updateDictationModelSetting = useCallback(
    async (modelId: DictationModelId | null, fallbackMessage: string) => {
      const actionResult = await onAction('settings.update', {
        key: 'dictationModelId',
        value: modelId,
      })

      const actionErrorMessage = getDesktopActionErrorMessage(actionResult, fallbackMessage)
      if (actionErrorMessage) {
        throw new Error(actionErrorMessage)
      }
    },
    [onAction],
  )

  const getActiveDictationModelId = useCallback(() => {
    return (
      dictationModels.find((model) => model.selected)?.id ??
      normalizeManagedDictationModelId(dictationState?.modelId) ??
      normalizeManagedDictationModelId(appSettings.dictationModelId) ??
      null
    )
  }, [appSettings.dictationModelId, dictationModels, dictationState?.modelId])

  const installDictationModel = async (modelId: DictationModelId) => {
    setDictationPendingAction({ modelId, kind: 'download' })
    setDictationInstallError(null)

    try {
      const result = await installDictationModelQuery(modelId)

      if (!result?.ok) {
        setDictationInstallError(result?.error ?? 'Could not download dictation model.')
        await refreshDictationState()
        return
      }

      setDictationPendingAction({ modelId, kind: 'switch' })
      await updateDictationModelSetting(modelId, 'Could not switch dictation model.')

      setDictationModels((current) =>
        current.map((model) => ({
          ...model,
          installed: model.id === modelId || model.installed,
          selected: model.id === modelId,
        })),
      )

      await refreshDictationState()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not download dictation model.'
      setDictationInstallError(message)
      await refreshDictationState()
    } finally {
      setDictationPendingAction(null)
    }
  }

  const deleteDictationModel = async (modelId: DictationModelId) => {
    const activeModelId = getActiveDictationModelId()
    setDictationPendingAction({ modelId, kind: 'delete' })
    setDictationInstallError(null)

    try {
      const result = await removeDictationModelQuery(modelId)
      if (!result?.ok) {
        setDictationInstallError(result?.error ?? 'Could not remove dictation model.')
        await refreshDictationState()
        return
      }
      await clearSelectedDictationModelIfDeleted({
        activeModelId,
        modelId,
        refreshDictationState,
        updateDictationModelSetting,
      })
      await refreshDictationState()
    } catch (error) {
      await refreshAfterDictationError({
        error,
        fallbackMessage: 'Could not remove dictation model.',
        refreshDictationState,
        setDictationInstallError,
      })
    } finally {
      setDictationPendingAction(null)
    }
  }

  return {
    deleteDictationModel,
    dictationInstallError,
    dictationModels,
    dictationPendingAction,
    installDictationModel,
  }
}
