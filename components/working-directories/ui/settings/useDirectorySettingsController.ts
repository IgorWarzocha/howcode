import type { AppSettings, DesktopActionInvoker } from '@howcode/desktop/types'
import { useState } from 'react'
import { useDirectorySettingsMaintenanceController } from './useDirectorySettingsMaintenanceController'

export function useDirectorySettingsController(input: {
  appSettings: AppSettings
  onAction: DesktopActionInvoker
}) {
  const preferredDirectoryLocation = input.appSettings.preferredDirectoryLocation ?? ''
  const [preferredDirectoryLocationEdit, setPreferredDirectoryLocationEdit] = useState<{
    source: string
    value: string
  } | null>(null)
  const preferredDirectoryLocationDraft =
    preferredDirectoryLocationEdit?.source === preferredDirectoryLocation
      ? preferredDirectoryLocationEdit.value
      : preferredDirectoryLocation
  const maintenance = useDirectorySettingsMaintenanceController(input)
  return {
    ...maintenance,
    preferredDirectoryLocationDraft,
    savePreferredDirectoryLocation: () =>
      void input.onAction('settings.update', {
        key: 'preferredDirectoryLocation',
        value: preferredDirectoryLocationDraft,
      }),
    setPreferredDirectoryLocationDraft: (value: string) =>
      setPreferredDirectoryLocationEdit({ source: preferredDirectoryLocation, value }),
    setDirectoryDeletionMode: (value: AppSettings['directoryDeletionMode']) =>
      void input.onAction('settings.update', { key: 'directoryDeletionMode', value }),
    toggleInitializeGitOnDirectoryCreate: () =>
      void input.onAction('settings.update', {
        key: 'initializeGitOnDirectoryCreate',
        value: !input.appSettings.initializeGitOnDirectoryCreate,
      }),
    toggleDirectoryDashboardEnabled: () =>
      void input.onAction('settings.update', {
        key: 'projectDashboardEnabled',
        value: !input.appSettings.directoryDashboardEnabled,
      }),
  }
}

export type DirectorySettingsController = ReturnType<typeof useDirectorySettingsController>
