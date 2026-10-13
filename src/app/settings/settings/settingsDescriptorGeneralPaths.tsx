import { composerTextActionButtonClass } from '@howaboua/howcode-sdk/ui/classes'
import { Input } from '@howaboua/howcode-sdk/ui/controls'
import { appToneMutedClass, appTypeMetaClass } from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { FolderCog } from 'lucide-react'
import type { AppSettings } from '../../desktop/types'
import type { SettingDescriptor } from './settingsTypes'
import type { SettingsGeneralPathsController } from './useSettingsGeneralPathsController'

export function buildGeneralPathsSettingsDescriptors({
  appSettings,
  controller,
}: {
  appSettings: AppSettings
  controller: { generalPaths: SettingsGeneralPathsController }
}): SettingDescriptor[] {
  return [
    {
      id: 'projects.custom-pi-directory',
      category: 'general',
      title: 'Pi resource directory',
      description:
        'Source for credentials, providers, skills, instructions and themes. Howcode preferences are stored separately.',
      keywords: 'pi directory agent dir custom path resources credentials models advanced',
      render: () => (
        <div className="relative w-[22rem] max-w-full">
          <FolderCog
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <Input
            type="text"
            value={controller.generalPaths.customPiDirectoryDraft}
            onChange={(event) =>
              controller.generalPaths.setCustomPiDirectoryDraft(event.target.value)
            }
            onBlur={controller.generalPaths.saveCustomPiDirectory}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              controller.generalPaths.saveCustomPiDirectory()
            }}
            className="w-full pl-9"
            placeholder={
              controller.generalPaths.resolvedPiDirectory
                ? `Default: ${controller.generalPaths.resolvedPiDirectory} (useful for WSL)`
                : 'Default: ~/.pi/agent (useful for WSL)'
            }
            aria-label="Pi resource directory"
          />
        </div>
      ),
    },
    {
      id: 'projects.favorite-folders',
      category: 'general',
      title: 'Favorite folders',
      description: 'Paths shown in the attachment picker alongside Home.',
      keywords: 'favorite folders attachment picker paths',
      render: () => (
        <div className="grid w-[28rem] max-w-full gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
            <Input
              type="text"
              value={controller.generalPaths.favoriteFolderDraft}
              onChange={(event) =>
                controller.generalPaths.setFavoriteFolderDraft(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                controller.generalPaths.addFavoriteFolder()
              }}
              className="h-8"
              placeholder="Absolute folder path"
              aria-label="Favorite folder path"
            />
            <button
              type="button"
              className={cn(composerTextActionButtonClass, 'h-8 justify-center')}
              onClick={controller.generalPaths.addFavoriteFolder}
              disabled={controller.generalPaths.favoriteFolderDraft.trim().length === 0}
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
                      controller.generalPaths.updateFavoriteFolders(
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
