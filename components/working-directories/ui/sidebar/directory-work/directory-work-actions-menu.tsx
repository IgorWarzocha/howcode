import { MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { IconButton } from '../../../../../src/app/common/icon-button'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { WorkingDirectory } from '../../../../../src/app/types'
import { WorktreeSmallIcon } from '../../../../../src/app/ui/icons/worktree-small-icon'
import { useDirectoryWorkRowMenu } from './useDirectoryWorkRowMenu'

export function DirectoryWorkActionsMenuButton({
  directory,
  onAction,
  onRename,
}: {
  directory: WorkingDirectory
  onAction: DesktopActionInvoker
  onRename?: (() => void) | undefined
}) {
  const menu = useDirectoryWorkRowMenu('directory')

  return (
    <div className="sidebar-project-work-project-menu-anchor">
      <IconButton
        ref={menu.triggerRef}
        label="Workspace actions"
        icon={<MoreHorizontal size={13} />}
        tooltipPlacement="right"
        className="sidebar-project-work-project-menu-button h-7 w-7 rounded-md"
        onClick={() => menu.setOpen((current) => !current)}
      />
      {menu.open ? (
        <DirectoryWorkActionsMenu
          ref={menu.panelRef}
          right={menu.right}
          width={menu.width}
          directory={directory}
          onAction={onAction}
          onClose={() => menu.setOpen(false)}
          onRename={
            onRename
              ? () => {
                  menu.setOpen(false)
                  onRename()
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

const DirectoryWorkActionsMenu = forwardRef<
  HTMLDivElement,
  {
    directory: WorkingDirectory
    right: number
    width: number
    onAction: DesktopActionInvoker
    onClose: () => void
    onRename?: (() => void) | undefined
  }
>(function DirectoryWorkActionsMenuPanel(
  { directory, right, width, onAction, onClose, onRename },
  ref,
) {
  const [confirmAction, setConfirmAction] = useState<'directory.remove' | null>(null)
  const [editingWorktreeDir, setEditingWorktreeDir] = useState(false)
  const [worktreeDirDraft, setWorktreeDirDraft] = useState(
    directory.worktreeDirectory ?? './.worktrees',
  )
  const worktreeDirInputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!editingWorktreeDir) return
    worktreeDirInputRef.current?.focus()
    worktreeDirInputRef.current?.select()
  }, [editingWorktreeDir])
  const runDirectoryAction = (action: 'directory.pin' | 'directory.remove') => {
    if (action === 'directory.remove') {
      if (confirmAction !== action) {
        setConfirmAction(action)
        return
      }
      setConfirmAction(null)
    }
    void onAction(action, { directoryId: directory.id, directoryName: directory.name })
    onClose()
  }
  const saveWorktreeDirectory = () => {
    const worktreeDirectory = worktreeDirDraft.trim() || './.worktrees'
    void onAction('worktrees.set-worktree-directory', {
      rootDirectoryId: directory.worktree?.rootDirectoryId ?? directory.id,
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
            setWorktreeDirDraft(directory.worktreeDirectory ?? './.worktrees')
            setEditingWorktreeDir(true)
          }}
          role="menuitem"
        >
          <WorktreeSmallIcon size={12} />
          <span>Worktree folder</span>
          <span className="sidebar-project-work-project-actions-menu-meta">
            {directory.worktreeDirectory ?? './.worktrees'}
          </span>
        </button>
      )}
      <button
        type="button"
        className="sidebar-menu-item sidebar-project-work-project-actions-menu-item"
        onClick={() => runDirectoryAction('directory.pin')}
        role="menuitem"
      >
        <Star size={12} className={directory.pinned ? 'fill-current' : undefined} />
        <span>{directory.pinned ? 'Unmark favourite' : 'Mark favourite'}</span>
      </button>
      <button
        type="button"
        className="sidebar-menu-item sidebar-project-work-project-actions-menu-item"
        data-danger="true"
        onClick={() => {
          runDirectoryAction('directory.remove')
        }}
        role="menuitem"
      >
        <Trash2 size={12} />
        <span>
          {confirmAction === 'directory.remove' ? 'Click to confirm' : 'Delete workspace'}
        </span>
      </button>
    </div>
  )
})
