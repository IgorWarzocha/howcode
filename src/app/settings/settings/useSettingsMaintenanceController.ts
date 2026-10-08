import { useState } from 'react'
import type { DesktopActionInvoker } from '../../desktop/types'
import {
  desktopBridgeUnavailableMessage,
  useDesktopBridgeAvailable,
} from '../../hooks/useDesktopBridge'
import { getActionError, getDirectoryImportSummaryMessage } from './helpers'

export function useSettingsMaintenanceController(input: { onAction: DesktopActionInvoker }) {
  const [importBusy, setImportBusy] = useState(false)
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null)
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null)
  const desktopBridgeAvailable = useDesktopBridgeAvailable()

  const handleImportDirectoryUi = async () => {
    if (!desktopBridgeAvailable) {
      setImportStatusMessage(null)
      setImportErrorMessage(desktopBridgeUnavailableMessage)
      return
    }
    setImportBusy(true)
    setImportStatusMessage('Scanning workspaces for UI info…')
    setImportErrorMessage(null)
    try {
      const result = await input.onAction('directories.import.apply', { directoryIds: [] })
      const error = getActionError(result)
      if (error) {
        setImportErrorMessage(error)
        setImportStatusMessage(null)
        return
      }
      setImportStatusMessage(getDirectoryImportSummaryMessage(result))
    } finally {
      setImportBusy(false)
    }
  }

  return {
    desktopBridgeAvailable,
    handleImportDirectoryUi,
    importBusy,
    importErrorMessage,
    importStatusMessage,
    showFirstLaunchReminderAgain: () =>
      void input.onAction('settings.update', { key: 'directoryImportState', imported: null }),
  }
}

export type SettingsMaintenanceController = ReturnType<typeof useSettingsMaintenanceController>
