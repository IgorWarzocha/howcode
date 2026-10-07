import { useState } from 'react'
import type { DesktopActionInvoker } from '../../desktop/types'
import {
  desktopBridgeUnavailableMessage,
  useDesktopBridgeAvailable,
} from '../../hooks/useDesktopBridge'
import { getActionError, getProjectImportSummaryMessage } from './helpers'

export function useSettingsMaintenanceController(input: { onAction: DesktopActionInvoker }) {
  const [importBusy, setImportBusy] = useState(false)
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null)
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null)
  const desktopBridgeAvailable = useDesktopBridgeAvailable()

  const handleImportProjectUi = async () => {
    if (!desktopBridgeAvailable) {
      setImportStatusMessage(null)
      setImportErrorMessage(desktopBridgeUnavailableMessage)
      return
    }
    setImportBusy(true)
    setImportStatusMessage('Scanning projects for UI info…')
    setImportErrorMessage(null)
    try {
      const result = await input.onAction('projects.import.apply', { projectIds: [] })
      const error = getActionError(result)
      if (error) {
        setImportErrorMessage(error)
        setImportStatusMessage(null)
        return
      }
      setImportStatusMessage(getProjectImportSummaryMessage(result))
    } finally {
      setImportBusy(false)
    }
  }

  return {
    desktopBridgeAvailable,
    handleImportProjectUi,
    importBusy,
    importErrorMessage,
    importStatusMessage,
    showFirstLaunchReminderAgain: () =>
      void input.onAction('settings.update', { key: 'projectImportState', imported: null }),
  }
}

export type SettingsMaintenanceController = ReturnType<typeof useSettingsMaintenanceController>
