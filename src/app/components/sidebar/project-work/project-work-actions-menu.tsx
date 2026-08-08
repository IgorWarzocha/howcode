import { IconButton } from '@howcode/common/icon-button'
import { FolderOpen, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Project } from '../../../types'
import { WorktreeSmallIcon } from '../../../ui/icons/worktree-small-icon'

export function ProjectWorkActionsMenuButton({
  project,
  onAction,
  onRename,
}: {
  project: Project
  onAction: DesktopActionInvoker
  onRename?: (() => void) | undefined
}) {
  const [open, setOpen] = useState(false)
  const [menuWidth, setMenuWidth] = useState(240)
  const [menuRight, setMenuRight] = useState(0)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useDismissibleLayer({
    open,
    onDismiss: () => setOpen(false),
    refs: [buttonRef, menuRef],
  })
  useLayoutEffect(() => {
    if (!(open && buttonRef.current)) return
    const anchor = buttonRef.current
    const row = anchor.closest(
      '.sidebar-project-work-project-block-heading-row, .sidebar-project-work-toolbar, .sidebar-project-work-section-heading',
    )
    const rowRect = row?.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    if (!rowRect) {
      setMenuWidth(anchor.offsetLeft + anchor.offsetWidth)
      setMenuRight(0)
      return
    }
    setMenuWidth(rowRect.width)
    setMenuRight(anchorRect.right - rowRect.right)
  }, [open])

  return (
    <div className="sidebar-project-work-project-menu-anchor">
      <IconButton
        ref={buttonRef}
        label="Project actions"
        icon={<MoreHorizontal size={13} />}
        tooltipPlacement="right"
        className="sidebar-project-work-project-menu-button h-7 w-7 rounded-md"
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <ProjectWorkActionsMenu
          ref={menuRef}
          right={menuRight}
          width={menuWidth}
          project={project}
          onAction={onAction}
          onClose={() => setOpen(false)}
          onRename={
            onRename
              ? () => {
                  setOpen(false)
                  onRename()
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

const ProjectWorkActionsMenu = forwardRef<
  HTMLDivElement,
  {
    project: Project
    right: number
    width: number
    onAction: DesktopActionInvoker
    onClose: () => void
    onRename?: (() => void) | undefined
  }
>(function ProjectWorkActionsMenuPanel(
  { project, right, width, onAction, onClose, onRename },
  ref,
) {
  const [confirmAction, setConfirmAction] = useState<'project.remove-project' | null>(null)
  const [editingWorktreeDir, setEditingWorktreeDir] = useState(false)
  const [worktreeDirDraft, setWorktreeDirDraft] = useState(
    project.worktreeDirectory ?? './.worktrees',
  )
  const worktreeDirInputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!editingWorktreeDir) return
    worktreeDirInputRef.current?.focus()
    worktreeDirInputRef.current?.select()
  }, [editingWorktreeDir])
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
  const saveWorktreeDirectory = () => {
    const worktreeDirectory = worktreeDirDraft.trim() || './.worktrees'
    void onAction('workspace.set-worktree-directory', {
      projectId: project.worktree?.rootProjectId ?? project.id,
      worktreeDirectory,
    })
    setEditingWorktreeDir(false)
    onClose()
  }

  return (
    <div
      ref={ref}
      className="sidebar-menu-surface sidebar-menu-surface--below-tight sidebar-project-work-project-actions-menu"
      style={{ right: `${right}px`, width: `${width}px` }}
      role="menu"
    >
      {onRename ? (
        <button
          type="button"
          className="sidebar-menu-item sidebar-project-work-project-actions-menu-item"
          onClick={onRename}
          role="menuitem"
        >
          <Pencil size={12} />
          <span>Rename</span>
        </button>
      ) : null}
      <button
        type="button"
        className="sidebar-menu-item sidebar-project-work-project-actions-menu-item"
        onClick={() => runProjectAction('project.open-in-file-manager')}
        role="menuitem"
      >
        <FolderOpen size={12} />
        <span>Reveal in file manager</span>
      </button>
      {editingWorktreeDir ? (
        <div className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-project-work-project-actions-menu-item sidebar-project-work-worktree-dir-item">
          <WorktreeSmallIcon size={12} />
          <input
            ref={worktreeDirInputRef}
            value={worktreeDirDraft}
            onChange={(event) => setWorktreeDirDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveWorktreeDirectory()
              if (event.key === 'Escape') setEditingWorktreeDir(false)
            }}
            aria-label="Worktree folder"
          />
          <button type="button" onClick={saveWorktreeDirectory}>
            Save
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-project-work-project-actions-menu-item"
          onClick={() => {
            setWorktreeDirDraft(project.worktreeDirectory ?? './.worktrees')
            setEditingWorktreeDir(true)
          }}
          role="menuitem"
        >
          <WorktreeSmallIcon size={12} />
          <span>Worktree folder</span>
          <span className="sidebar-project-work-project-actions-menu-meta">
            {project.worktreeDirectory ?? './.worktrees'}
          </span>
        </button>
      )}
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
