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
  const [clearImagesBusy, setClearImagesBusy] = useState(false)
  const [clearImagesStatusMessage, setClearImagesStatusMessage] = useState<string | null>(null)
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

  const handleClearClipboardImages = async () => {
    if (!desktopBridgeAvailable) {
      setClearImagesStatusMessage(desktopBridgeUnavailableMessage)
      return
    }
    setClearImagesBusy(true)
    setClearImagesStatusMessage(null)
    try {
      const result = await input.onAction('settings.clear-clipboard-images', {})
      const error = getActionError(result)
      if (error) {
        setClearImagesStatusMessage(error)
        return
      }
      const clearedCount = result?.result?.clearedCount ?? 0
      const failedCount = result?.result?.clearFailedCount ?? 0
      const deletedMessage =
        clearedCount === 1
          ? 'Deleted 1 clipboard image.'
          : `Deleted ${clearedCount} clipboard images.`
      setClearImagesStatusMessage(
        failedCount > 0 ? `${deletedMessage} ${failedCount} failed.` : deletedMessage,
      )
    } finally {
      setClearImagesBusy(false)
    }
  }

  return {
    clearImagesBusy,
    clearImagesStatusMessage,
    desktopBridgeAvailable,
    handleClearClipboardImages,
    handleImportProjectUi,
    importBusy,
    importErrorMessage,
    importStatusMessage,
    showFirstLaunchReminderAgain: () =>
      void input.onAction('settings.update', { key: 'projectImportState', imported: null }),
  }
}

export type SettingsMaintenanceController = ReturnType<typeof useSettingsMaintenanceController>
