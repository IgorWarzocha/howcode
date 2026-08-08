import { Trash2 } from 'lucide-react'
import type { AppSettings } from '../../desktop/types'
import {
  appToneDangerClass,
  appToneMutedClass,
  appTypeMetaClass,
  appTypeSmallClass,
  composerTextActionButtonClass,
  settingsInputClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SettingsController } from './settingsDescriptorTypes'
import { SettingsSegmentedControl } from './settingsSegmentedControl'
import type { SettingDescriptor } from './settingsTypes'

export function buildProjectMaintenanceSettingsDescriptors({
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
      title: 'Project deletion cleanup',
      description: 'Delete only Pi session files, or nuke the full project folder.',
      keywords: 'delete deletion cleanup project full clean pi only',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-2"
          value={appSettings.projectDeletionMode}
          options={[
            { value: 'pi-only', label: 'Pi only' },
            { value: 'full-clean', label: 'Full clean' },
          ]}
          onChange={controller.projects.setProjectDeletionMode}
        />
      ),
    },
    {
      id: 'projects.import-ui',
      category: 'howcode',
      title: 'Project UI import',
      description: 'Scan projects for UI info like repo and origin status.',
      keywords: 'project import ui scan repo origin first launch',
      render: () => (
        <div className="grid justify-items-end gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={composerTextActionButtonClass}
              onClick={() => void controller.projects.handleImportProjectUi()}
              disabled={
                controller.projects.importBusy || !controller.projects.desktopBridgeAvailable
              }
            >
              {controller.projects.importBusy
                ? 'Importing…'
                : appSettings.projectImportState
                  ? 'Run again'
                  : 'Import now'}
            </button>
            {appSettings.projectImportState === false ? (
              <button
                type="button"
                className={composerTextActionButtonClass}
                onClick={controller.projects.showFirstLaunchReminderAgain}
              >
                Show reminder
              </button>
            ) : null}
          </div>
          {controller.projects.importStatusMessage ? (
            <div className={`text-right ${appTypeSmallClass} ${appToneMutedClass}`}>
              {controller.projects.importStatusMessage}
            </div>
          ) : null}
          {controller.projects.desktopBridgeAvailable ? null : (
            <div className={`text-right ${appTypeSmallClass} ${appToneMutedClass}`}>
              Project sync needs the desktop bridge.
            </div>
          )}
          {controller.projects.importErrorMessage ? (
            <div className={`text-right ${appTypeSmallClass} ${appToneDangerClass}`}>
              {controller.projects.importErrorMessage}
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
            <input
              type="text"
              value={controller.projects.favoriteFolderDraft}
              onChange={(event) => controller.projects.setFavoriteFolderDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                controller.projects.addFavoriteFolder()
              }}
              className={cn(settingsInputClass, 'h-8')}
              placeholder="Absolute folder path"
              aria-label="Favorite folder path"
            />
            <button
              type="button"
              className={cn(composerTextActionButtonClass, 'h-8 justify-center')}
              onClick={controller.projects.addFavoriteFolder}
              disabled={controller.projects.favoriteFolderDraft.trim().length === 0}
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
                      controller.projects.updateFavoriteFolders(
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
    {
      id: 'projects.clipboard-images',
      category: 'howcode',
      title: 'Clipboard images',
      description: 'Delete temp clipboard images.',
      keywords: 'clipboard images screenshots attachments delete cleanup temp',
      render: () => (
        <div className="flex max-w-full items-center justify-end gap-2">
          {controller.projects.clearImagesStatusMessage ? (
            <div
              className={`min-w-0 truncate text-right ${appTypeSmallClass} ${appToneMutedClass}`}
            >
              {controller.projects.clearImagesStatusMessage}
            </div>
          ) : null}
          <button
            type="button"
            className={cn(composerTextActionButtonClass, 'shrink-0 text-[color:var(--danger)]')}
            onClick={() => void controller.projects.handleClearClipboardImages()}
            disabled={
              controller.projects.clearImagesBusy || !controller.projects.desktopBridgeAvailable
            }
          >
            <Trash2 size={12} />
            {controller.projects.clearImagesBusy ? 'Deleting…' : 'Delete images'}
          </button>
        </div>
      ),
    },
  ]
}
