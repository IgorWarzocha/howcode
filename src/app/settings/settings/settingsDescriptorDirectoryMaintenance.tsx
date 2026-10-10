import { composerTextActionButtonClass } from '@howaboua/howcode-sdk/ui/classes'
import { Input } from '@howaboua/howcode-sdk/ui/controls'
import { SegmentedControl } from '@howaboua/howcode-sdk/ui/inline-select'
import {
  appToneDangerClass,
  appToneMutedClass,
  appTypeMetaClass,
  appTypeSmallClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import type { AppSettings } from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

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
      category: 'howcode',
      title: 'Workspace deletion cleanup',
      description: 'Remove conversations from Howcode, or also delete the workspace folder.',
      keywords: 'delete deletion cleanup workspace full clean pi only',
      render: () => (
        <SegmentedControl
          columnsClassName="grid-cols-2"
          value={appSettings.directoryDeletionMode}
          options={[
            { value: 'pi-only', label: 'Pi only' },
            { value: 'full-clean', label: 'Full clean' },
          ]}
          onChange={controller.directories.setDirectoryDeletionMode}
        />
      ),
    },
    {
      id: 'projects.import-ui',
      category: 'howcode',
      title: 'Workspace UI import',
      description: 'Scan workspaces for UI info like repo and origin status.',
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
                ? 'Importing…'
                : appSettings.directoryImportState
                  ? 'Run again'
                  : 'Import now'}
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
    {
      id: 'projects.favorite-folders',
      category: 'howcode',
      title: 'Favorite folders',
      description: 'Paths shown in the attachment picker alongside Home.',
      keywords: 'favorite folders attachment picker paths',
      render: () => (
        <div className="grid w-[28rem] max-w-full gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
            <Input
              type="text"
              value={controller.directories.favoriteFolderDraft}
              onChange={(event) =>
                controller.directories.setFavoriteFolderDraft(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                controller.directories.addFavoriteFolder()
              }}
              className="h-8"
              placeholder="Absolute folder path"
              aria-label="Favorite folder path"
            />
            <button
              type="button"
              className={cn(composerTextActionButtonClass, 'h-8 justify-center')}
              onClick={controller.directories.addFavoriteFolder}
              disabled={controller.directories.favoriteFolderDraft.trim().length === 0}
            >
              Add
            </button>
          </div>
          {appSettings.favoriteFolders.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {appSettings.favoriteFolders.map((folder) => (
                <span
                  key={folder}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] py-1 pr-1 pl-2 ${appTypeMetaClass} ${appToneMutedClass}`}
                >
                  <span className="max-w-[18rem] truncate" title={folder}>
                    {folder}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text)]"
                    onClick={() =>
                      controller.directories.updateFavoriteFolders(
                        appSettings.favoriteFolders.filter((current) => current !== folder),
                      )
                    }
                    aria-label={`Remove ${folder}`}
                    data-tooltip={`Remove ${folder}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
  ]
}
