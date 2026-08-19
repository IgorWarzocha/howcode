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

export function useSettingsProjectController(input: {
  appSettings: AppSettings
  onAction: DesktopActionInvoker
  resolvedPiDirectory?: string | null | undefined
}) {
  const preferredProjectLocation = input.appSettings.preferredProjectLocation ?? ''
  const customPiDirectory = input.appSettings.customPiDirectory ?? ''
  const [preferredProjectLocationEdit, setPreferredProjectLocationEdit] = useState<{
    source: string
    value: string
  } | null>(null)
  const [customPiDirectoryEdit, setCustomPiDirectoryEdit] = useState<{
    source: string
    value: string
  } | null>(null)
  const [favoriteFolderDraft, setFavoriteFolderDraft] = useState('')
  const preferredProjectLocationDraft =
    preferredProjectLocationEdit?.source === preferredProjectLocation
      ? preferredProjectLocationEdit.value
      : preferredProjectLocation
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
    preferredProjectLocationDraft,
    resolvedPiDirectory: input.resolvedPiDirectory,
    saveCustomPiDirectory: () => {
      const value = normalizeCustomPiDirectoryDraft(
        customPiDirectoryDraft,
        input.appSettings.customPiDirectory,
      )
      if (value === normalizeOptionalSettingsPath(input.appSettings.customPiDirectory)) return
      void input.onAction('settings.update', { key: 'customPiDirectory', value })
    },
    savePreferredProjectLocation: () =>
      void input.onAction('settings.update', {
        key: 'preferredProjectLocation',
        value: preferredProjectLocationDraft,
      }),
    setCustomPiDirectoryDraft: (value: string) =>
      setCustomPiDirectoryEdit({ source: customPiDirectory, value }),
    setFavoriteFolderDraft,
    setGitDiffBaselineDefault: (value: AppSettings['gitDiffBaselineDefault']) =>
      void input.onAction('settings.update', { key: 'gitDiffBaselineDefault', value }),
    setGitDiffFileTreeDefaultVisible: (value: boolean) =>
      void input.onAction('settings.update', { key: 'gitDiffFileTreeDefaultVisible', value }),
    setGitDiffIncludeUntrackedDefault: (value: boolean) =>
      void input.onAction('settings.update', { key: 'gitDiffIncludeUntrackedDefault', value }),
    setGitDiffRenderModeDefault: (value: AppSettings['gitDiffRenderModeDefault']) =>
      void input.onAction('settings.update', { key: 'gitDiffRenderModeDefault', value }),
    setGitOpsDefaultMode: (value: AppSettings['gitOpsDefaultMode']) =>
      void input.onAction('settings.update', { key: 'gitOpsDefaultMode', value }),
    setPreferredProjectLocationDraft: (value: string) =>
      setPreferredProjectLocationEdit({ source: preferredProjectLocation, value }),
    setProjectDeletionMode: (value: AppSettings['projectDeletionMode']) =>
      void input.onAction('settings.update', { key: 'projectDeletionMode', value }),
    toggleInitializeGitOnProjectCreate: () =>
      void input.onAction('settings.update', {
        key: 'initializeGitOnProjectCreate',
        value: !input.appSettings.initializeGitOnProjectCreate,
      }),
    toggleProjectDashboardEnabled: () =>
      void input.onAction('settings.update', {
        key: 'projectDashboardEnabled',
        value: !input.appSettings.projectDashboardEnabled,
      }),
    updateFavoriteFolders,
  }
}

export type SettingsProjectController = ReturnType<typeof useSettingsProjectController>
