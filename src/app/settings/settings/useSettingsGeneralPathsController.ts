import { useState } from 'react'
import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'

export function normalizeOptionalSettingsPath(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? ''
  return normalizedValue.length > 0 ? normalizedValue : null
}

export function normalizeCustomPiDirectoryDraft(
  draftValue: string | null | undefined,
  currentValue: string | null | undefined,
) {
  const normalizedDraft = normalizeOptionalSettingsPath(draftValue)
  if (!normalizedDraft) return null
  const normalizedCurrent = normalizeOptionalSettingsPath(currentValue)
  if (!(normalizedCurrent && (normalizedDraft === '~' || normalizedDraft.startsWith('~/')))) {
    return normalizedDraft
  }

  const suffix = normalizedDraft === '~' ? '' : normalizedDraft.slice(1)
  if (normalizedDraft === '~' || normalizedCurrent.endsWith(suffix)) {
    return `${normalizedCurrent.slice(0, normalizedCurrent.length - suffix.length)}${suffix}`
  }
  return normalizedDraft
}

export function useSettingsGeneralPathsController(input: {
  appSettings: AppSettings
  onAction: DesktopActionInvoker
  resolvedPiDirectory?: string | null | undefined
}) {
  const customPiDirectory = input.appSettings.customPiDirectory ?? ''
  const [customPiDirectoryEdit, setCustomPiDirectoryEdit] = useState<{
    source: string
    value: string
  } | null>(null)
  const [favoriteFolderDraft, setFavoriteFolderDraft] = useState('')
  const customPiDirectoryDraft =
    customPiDirectoryEdit?.source === customPiDirectory
      ? customPiDirectoryEdit.value
      : customPiDirectory

  const updateFavoriteFolders = (folders: string[]) =>
    void input.onAction('settings.update', { key: 'favoriteFolders', folders })

  return {
    addFavoriteFolder: () => {
      const folder = favoriteFolderDraft.trim()
      if (!folder) return
      updateFavoriteFolders([...input.appSettings.favoriteFolders, folder])
      setFavoriteFolderDraft('')
    },
    customPiDirectoryDraft,
    favoriteFolderDraft,
    resolvedPiDirectory: input.resolvedPiDirectory,
    saveCustomPiDirectory: () => {
      const value = normalizeCustomPiDirectoryDraft(
        customPiDirectoryDraft,
        input.appSettings.customPiDirectory,
      )
      if (value === normalizeOptionalSettingsPath(input.appSettings.customPiDirectory)) return
      void input.onAction('settings.update', { key: 'customPiDirectory', value })
    },
    setCustomPiDirectoryDraft: (value: string) =>
      setCustomPiDirectoryEdit({ source: customPiDirectory, value }),
    setFavoriteFolderDraft,
    updateFavoriteFolders,
  }
}

export type SettingsGeneralPathsController = ReturnType<typeof useSettingsGeneralPathsController>
