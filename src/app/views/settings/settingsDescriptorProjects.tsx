import { FolderPlus, Trash2 } from 'lucide-react'
import type { AppSettings } from '../../desktop/types'
import { composerTextActionButtonClass, settingsInputClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'
import { ToggleBox } from './settingsUi'

export function buildProjectsSettingsDescriptors({
  appSettings,
  controller,
}: {
  appSettings: AppSettings
  controller: SettingsController
}): SettingDescriptor[] {
  return [
    {
      id: 'projects.default-location',
      category: 'projects',
      title: 'Default project location',
      description: 'Default folder for new projects.',
      keywords: 'project folder location path default',
      render: () => (
        <div className="relative w-[22rem] max-w-full">
          <FolderPlus
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            type="text"
            value={controller.preferredProjectLocationDraft}
            onChange={(event) => controller.setPreferredProjectLocationDraft(event.target.value)}
            onBlur={controller.savePreferredProjectLocation}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                controller.savePreferredProjectLocation()
              }
            }}
            className={cn(settingsInputClass, 'w-full pl-9')}
            placeholder="Paste an absolute folder path"
            aria-label="Default project location"
          />
        </div>
      ),
    },
    {
      id: 'projects.initialize-git',
      category: 'projects',
      title: 'Initialise git',
      description: 'Always git init when creating a new project.',
      keywords: 'git init initialize projects diffs',
      render: () => (
        <ToggleBox
          checked={appSettings.initializeGitOnProjectCreate}
          label="Initialise git"
          onClick={controller.toggleInitializeGitOnProjectCreate}
        />
      ),
    },
    {
      id: 'projects.gitops-default',
      category: 'projects',
      title: 'GitOps default',
      description: 'Default global commit action.',
      keywords: 'gitops commit push default project',
      render: () => (
        <div className="grid grid-cols-2 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
          {[
            ['commit', 'Commit'],
            ['commit-push', 'Commit & push'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded-full px-3 py-1 transition-colors active:scale-[0.96]',
                appSettings.gitOpsDefaultMode === value &&
                  'bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--accent-border)]',
              )}
              onClick={() =>
                controller.setGitOpsDefaultMode(value as AppSettings['gitOpsDefaultMode'])
              }
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'projects.git-diff-baseline-default',
      category: 'projects',
      title: 'Diff comparison default',
      description: 'Default baseline setting for git summary.',
      keywords: 'git diff baseline comparison files lines default',
      render: () => (
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)] xl:grid-cols-5">
          {[
            [{ kind: 'head' }, 'Last'],
            [{ kind: 'previous' }, 'Prev'],
            [{ kind: 'dev-branch' }, 'Dev'],
            [{ kind: 'main-branch' }, 'Main'],
            [{ kind: 'yesterday' }, 'Yesterday'],
          ].map(([value, label]) => {
            const baseline = value as AppSettings['gitDiffBaselineDefault']
            return (
              <button
                key={baseline.kind}
                type="button"
                className={cn(
                  'rounded-xl px-3 py-1 transition-colors active:scale-[0.96]',
                  appSettings.gitDiffBaselineDefault.kind === baseline.kind &&
                    'bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--accent-border)]',
                )}
                onClick={() => controller.setGitDiffBaselineDefault(baseline)}
              >
                {label as string}
              </button>
            )
          })}
        </div>
      ),
    },
    {
      id: 'projects.git-diff-render-default',
      category: 'projects',
      title: 'Diff view default',
      description: 'Default layout for the GitOps diff panel.',
      keywords: 'git diff layout stacked split default',
      render: () => (
        <div className="grid grid-cols-2 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
          {[
            ['stacked', 'Unified'],
            ['split', 'Split'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded-full px-3 py-1 transition-colors active:scale-[0.96]',
                appSettings.gitDiffRenderModeDefault === value &&
                  'bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--accent-border)]',
              )}
              onClick={() =>
                controller.setGitDiffRenderModeDefault(
                  value as AppSettings['gitDiffRenderModeDefault'],
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },

    {
      id: 'projects.git-diff-file-tree-default',
      category: 'projects',
      title: 'Diff file tree',
      description: 'Default visibility for the GitOps file tree.',
      keywords: 'git diff file tree changed files sidebar default',
      render: () => (
        <ToggleBox
          checked={appSettings.gitDiffFileTreeDefaultVisible}
          label="Show file tree"
          onClick={() =>
            controller.setGitDiffFileTreeDefaultVisible(!appSettings.gitDiffFileTreeDefaultVisible)
          }
        />
      ),
    },
    {
      id: 'projects.deletion-mode',
      category: 'projects',
      title: 'Project deletion cleanup',
      description: 'Delete only Pi session files, or nuke the full project folder.',
      keywords: 'delete deletion cleanup project full clean pi only',
      render: () => (
        <div className="grid grid-cols-2 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] p-1 text-[12px] text-[color:var(--muted)]">
          {[
            ['pi-only', 'Pi only'],
            ['full-clean', 'Full clean'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded-full px-3 py-1 transition-colors active:scale-[0.96]',
                appSettings.projectDeletionMode === value &&
                  'bg-[rgba(255,255,255,0.18)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--accent-border)]',
              )}
              onClick={() =>
                controller.setProjectDeletionMode(value as AppSettings['projectDeletionMode'])
              }
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'projects.import-ui',
      category: 'projects',
      title: 'Project UI import',
      description: 'Scan projects for UI info like repo and origin status.',
      keywords: 'project import ui scan repo origin first launch',
      render: () => (
        <div className="grid justify-items-end gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={composerTextActionButtonClass}
              onClick={() => void controller.handleImportProjectUi()}
              disabled={controller.importBusy || !controller.desktopBridgeAvailable}
            >
              {controller.importBusy
                ? 'Importing…'
                : appSettings.projectImportState
                  ? 'Run again'
                  : 'Import now'}
            </button>
            {appSettings.projectImportState === false ? (
              <button
                type="button"
                className={cn(composerTextActionButtonClass, 'text-[12px]')}
                onClick={controller.showFirstLaunchReminderAgain}
              >
                Show reminder
              </button>
            ) : null}
          </div>
          {controller.importStatusMessage ? (
            <div className="text-right text-[12px] text-[color:var(--muted)]">
              {controller.importStatusMessage}
            </div>
          ) : null}
          {controller.desktopBridgeAvailable ? null : (
            <div className="text-right text-[12px] text-[color:var(--muted)]">
              Project sync needs the desktop bridge.
            </div>
          )}
          {controller.importErrorMessage ? (
            <div className="text-right text-[12px] text-[color:var(--danger)]">
              {controller.importErrorMessage}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'projects.favorite-folders',
      category: 'projects',
      title: 'Favorite folders',
      description: 'Paths shown in the attachment picker alongside Home.',
      keywords: 'favorite folders attachment picker paths',
      render: () => (
        <div className="grid w-[28rem] max-w-full gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
            <input
              type="text"
              value={controller.favoriteFolderDraft}
              onChange={(event) => controller.setFavoriteFolderDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  controller.addFavoriteFolder()
                }
              }}
              className={cn(settingsInputClass, 'h-8')}
              placeholder="Absolute folder path"
              aria-label="Favorite folder path"
            />
            <button
              type="button"
              className={cn(composerTextActionButtonClass, 'h-8 justify-center')}
              onClick={controller.addFavoriteFolder}
              disabled={controller.favoriteFolderDraft.trim().length === 0}
            >
              Add
            </button>
          </div>
          {appSettings.favoriteFolders.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {appSettings.favoriteFolders.map((folder) => (
                <span
                  key={folder}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] py-1 pr-1 pl-2 text-[11.5px] text-[color:var(--muted)]"
                >
                  <span className="max-w-[18rem] truncate" title={folder}>
                    {folder}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text)]"
                    onClick={() =>
                      controller.updateFavoriteFolders(
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
      category: 'projects',
      title: 'Clipboard images',
      description: 'Delete temp clipboard images.',
      keywords: 'clipboard images screenshots attachments delete cleanup temp',
      render: () => (
        <div className="flex max-w-full items-center justify-end gap-2">
          {controller.clearImagesStatusMessage ? (
            <div className="min-w-0 truncate text-right text-[12px] text-[color:var(--muted)]">
              {controller.clearImagesStatusMessage}
            </div>
          ) : null}
          <button
            type="button"
            className={cn(composerTextActionButtonClass, 'shrink-0 text-[color:var(--danger)]')}
            onClick={() => void controller.handleClearClipboardImages()}
            disabled={controller.clearImagesBusy || !controller.desktopBridgeAvailable}
          >
            <Trash2 size={12} />
            {controller.clearImagesBusy ? 'Deleting…' : 'Delete images'}
          </button>
        </div>
      ),
    },
  ]
}
