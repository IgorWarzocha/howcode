import { FolderOpen, Pencil, Star, Trash2 } from 'lucide-react'
import { forwardRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'

export const ProjectWorkActionsMenu = forwardRef<
  HTMLDivElement,
  {
    project: Project
    right: number
    width: number
    onAction: DesktopActionInvoker
    onClose: () => void
    onRename: () => void
  }
>(function ProjectWorkActionsMenuPanel(
  { project, right, width, onAction, onClose, onRename },
  ref,
) {
  const [confirmAction, setConfirmAction] = useState<'project.remove-project' | null>(null)
  const runProjectAction = (
    action: 'project.open-in-file-manager' | 'project.pin' | 'project.remove-project',
  ) => {
    if (action === 'project.remove-project') {
      if (confirmAction !== action) {
        setConfirmAction(action)
        return
      }
      setConfirmAction(null)
    }
    void onAction(action, { projectId: project.id, projectName: project.name })
    onClose()
  }

  return (
    <div
      ref={ref}
      className="sidebar-menu-surface sidebar-menu-surface--below-tight sidebar-project-work-project-actions-menu"
      style={{ right: `${right}px`, width: `${width}px` }}
      role="menu"
    >
      <button
        type="button"
        className="sidebar-menu-item sidebar-project-work-project-actions-menu-item"
        onClick={onRename}
        role="menuitem"
      >
        <Pencil size={12} />
        <span>Rename</span>
      </button>
      <button
        type="button"
        className="sidebar-menu-item sidebar-project-work-project-actions-menu-item"
        onClick={() => runProjectAction('project.open-in-file-manager')}
        role="menuitem"
      >
        <FolderOpen size={12} />
        <span>Reveal in file manager</span>
      </button>
      <button
        type="button"
        className="sidebar-menu-item sidebar-project-work-project-actions-menu-item"
        onClick={() => runProjectAction('project.pin')}
        role="menuitem"
      >
        <Star size={12} className={project.pinned ? 'fill-current' : undefined} />
        <span>{project.pinned ? 'Unmark favourite' : 'Mark favourite'}</span>
      </button>
      <button
        type="button"
        className="sidebar-menu-item sidebar-project-work-project-actions-menu-item"
        data-danger="true"
        onClick={() => {
          runProjectAction('project.remove-project')
        }}
        role="menuitem"
      >
        <Trash2 size={12} />
        <span>
          {confirmAction === 'project.remove-project' ? 'Click to confirm' : 'Delete project'}
        </span>
      </button>
    </div>
  )
})
