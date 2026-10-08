import { Check, FolderCode } from 'lucide-react'
import { GitHubInvertocatMark } from '../../../../../src/app/common/github-invertocat-mark'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { WorkingDirectory } from '../../../../../src/app/types'

export function DirectoryInstallTargetList({
  directories,
  selectedDirectoryId,
  terminalRunningWorkspaceIds,
  onAction,
  onDirectoryPrimeSelection,
  onDirectoryTargetSelected,
}: {
  directories: WorkingDirectory[]
  selectedDirectoryId: string
  terminalRunningWorkspaceIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onDirectoryPrimeSelection: (directoryId: string) => void
  onDirectoryTargetSelected?: (() => void) | undefined
}) {
  return (
    <div className="sidebar-project-work-lane sidebar-project-work-install-targets">
      <div className="sidebar-project-work-install-target-copy">Choose install target</div>
      <div className="sidebar-project-work-install-target-scroll-shell">
        <div className="sidebar-project-work-project-list sidebar-project-work-install-target-list">
          {directories.map((directory) => {
            const selected = directory.id === selectedDirectoryId
            return (
              <button
                key={directory.id}
                type="button"
                className="sidebar-compact-row sidebar-compact-row--project-option sidebar-project-work-project-option"
                data-active={selected ? 'true' : 'false'}
                aria-current={selected ? 'true' : undefined}
                onClick={() => {
                  onDirectoryPrimeSelection(directory.id)
                  window.dispatchEvent(new CustomEvent('howcode:project-target-selected'))
                  onDirectoryTargetSelected?.()
                  void onAction('directory.select', { directoryId: directory.id })
                }}
              >
                <span
                  className="sidebar-project-work-project-scope-toggle"
                  data-checked={selected ? 'true' : 'false'}
                  aria-hidden="true"
                >
                  {selected ? <Check size={11} /> : null}
                </span>
                <span className="sidebar-project-work-project-focus">
                  {directory.repoOriginUrl ? (
                    <GitHubInvertocatMark size={13} />
                  ) : (
                    <FolderCode size={13} />
                  )}
                  <span className="truncate">{directory.name}</span>
                </span>
                {terminalRunningWorkspaceIds.has(directory.id) ? (
                  <span
                    className="sidebar-project-work-live-dot"
                    title="Running terminal"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
