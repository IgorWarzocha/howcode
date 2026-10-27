import { composerTextActionButtonClass } from '@howaboua/howcode-sdk/ui/classes'
import { SegmentedControl } from '@howaboua/howcode-sdk/ui/inline-select'
import {
  appToneDangerClass,
  appToneMutedClass,
  appTypeSmallClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import type { AppSettings } from '@howcode/desktop/types'
import type { SettingDescriptor } from '@howcode/settings/settingsTypes'
import type { DirectorySettingsController } from './useDirectorySettingsController'

type SettingsController = { directories: DirectorySettingsController }

export function buildDirectoryMaintenanceSettingsDescriptors({
  appSettings,
  controller,
}: {
  appSettings: AppSettings
  controller: SettingsController
}): SettingDescriptor[] {
  return [
    {
      id: 'projects.deletion-mode',
      category: 'general',
      section: 'Workspaces',
      title: 'Workspace deletion cleanup',
      description: 'Remove conversations from Howcode, or also delete the workspace folder.',
      keywords: 'delete deletion cleanup workspace conversations folder',
      render: () => (
        <SegmentedControl
          columnsClassName="grid-cols-2"
          value={appSettings.directoryDeletionMode}
          options={[
            { value: 'pi-only', label: 'Conversations only' },
            { value: 'full-clean', label: 'Also delete folder' },
          ]}
          onChange={controller.directories.setDirectoryDeletionMode}
        />
      ),
    },
    {
      id: 'projects.import-ui',
      category: 'general',
      section: 'Workspaces',
      title: 'Refresh workspace metadata',
      description: 'Scan workspace folders for repository and origin status.',
      keywords: 'workspace import ui scan repo origin first launch',
      render: () => (
        <div className="grid justify-items-end gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={composerTextActionButtonClass}
              onClick={() => void controller.directories.handleImportDirectoryUi()}
              disabled={
                controller.directories.importBusy || !controller.directories.desktopBridgeAvailable
              }
            >
              {controller.directories.importBusy
                ? 'Refreshing…'
                : appSettings.directoryImportState
                  ? 'Run again'
                  : 'Refresh now'}
            </button>
            {appSettings.directoryImportState === false ? (
              <button
                type="button"
                className={composerTextActionButtonClass}
                onClick={controller.directories.showFirstLaunchReminderAgain}
              >
                Show reminder
              </button>
            ) : null}
          </div>
          {controller.directories.importStatusMessage ? (
            <div className={`text-right ${appTypeSmallClass} ${appToneMutedClass}`}>
              {controller.directories.importStatusMessage}
            </div>
          ) : null}
          {controller.directories.desktopBridgeAvailable ? null : (
            <div className={`text-right ${appTypeSmallClass} ${appToneMutedClass}`}>
              Workspace sync needs the desktop bridge.
            </div>
          )}
          {controller.directories.importErrorMessage ? (
            <div className={`text-right ${appTypeSmallClass} ${appToneDangerClass}`}>
              {controller.directories.importErrorMessage}
            </div>
          ) : null}
        </div>
      ),
    },
  ]
}
