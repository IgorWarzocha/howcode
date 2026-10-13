import type { DesktopActionInvoker, DesktopActionResult } from '@howcode/desktop/types'
import { getActionError } from '@howcode/settings/helpers'
import { useState } from 'react'
import {
  desktopBridgeUnavailableMessage,
  useDesktopBridgeAvailable,
} from '../../../../src/app/hooks/useDesktopBridge'

export function useDirectorySettingsMaintenanceController(input: {
  onAction: DesktopActionInvoker
}) {
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
    setImportStatusMessage('Scanning workspace metadata…')
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

export type DirectorySettingsMaintenanceController = ReturnType<
  typeof useDirectorySettingsMaintenanceController
>

function getDirectoryImportSummaryMessage(result: DesktopActionResult | null) {
  const checkedDirectoryCount =
    typeof result?.result?.checkedDirectoryCount === 'number'
      ? result.result.checkedDirectoryCount
      : 0
  const originDirectoryCount =
    typeof result?.result?.originDirectoryCount === 'number'
      ? result.result.originDirectoryCount
      : 0

  return checkedDirectoryCount > 0
    ? `Scanned ${checkedDirectoryCount} · Found ${originDirectoryCount} origins`
    : 'Nothing to scan'
}
