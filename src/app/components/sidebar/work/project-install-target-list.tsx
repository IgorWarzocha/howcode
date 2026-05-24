import { GitHubInvertocatMark } from '@howcode/common/github-invertocat-mark'
import { Check, FolderCode } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'

export function ProjectInstallTargetList({
  projects,
  selectedProjectId,
  terminalRunningProjectIds,
  onAction,
  onProjectPrimeSelection,
  onProjectTargetSelected,
}: {
  projects: Project[]
  selectedProjectId: string
  terminalRunningProjectIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onProjectPrimeSelection: (projectId: string) => void
  onProjectTargetSelected?: (() => void) | undefined
}) {
  return (
    <div className="sidebar-work-lane sidebar-work-install-targets">
      <div className="sidebar-work-install-target-copy">Choose install target</div>
      <div className="sidebar-work-install-target-scroll-shell">
        <div className="sidebar-work-project-list sidebar-work-install-target-list">
          {projects.map((project) => {
            const selected = project.id === selectedProjectId
            return (
              <button
                key={project.id}
                type="button"
                className="sidebar-work-project-option"
                data-active={selected ? 'true' : 'false'}
                aria-current={selected ? 'true' : undefined}
                onClick={() => {
                  onProjectPrimeSelection(project.id)
                  window.dispatchEvent(new CustomEvent('howcode:project-target-selected'))
                  onProjectTargetSelected?.()
                  void onAction('project.select', { projectId: project.id })
                }}
              >
                <span
                  className="sidebar-work-project-scope-toggle"
                  data-checked={selected ? 'true' : 'false'}
                  aria-hidden="true"
                >
                  {selected ? <Check size={11} /> : null}
                </span>
                <span className="sidebar-work-project-focus">
                  {project.repoOriginUrl ? (
                    <GitHubInvertocatMark size={13} />
                  ) : (
                    <FolderCode size={13} />
                  )}
                  <span className="truncate">{project.name}</span>
                </span>
                {terminalRunningProjectIds.has(project.id) ? (
                  <span
                    className="sidebar-work-live-dot"
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
