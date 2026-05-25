import { IconButton } from '@howcode/common/icon-button'
import { GitBranch, GitFork, Plus, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'

export async function createThreadForBranch({
  branchName,
  onAction,
  projectId,
}: {
  branchName: string | null
  onAction: DesktopActionInvoker
  projectId: string
}) {
  await onAction('thread.new', {
    projectId,
    composerMode: 'code',
    branchName,
  })
}

export function NewThreadMenu({
  currentBranch,
  dirtyMessage,
  onAction,
  projectId,
}: {
  currentBranch: string | null
  dirtyMessage: string | null
  onAction: DesktopActionInvoker
  projectId: string
}) {
  const [open, setOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchError, setNewBranchError] = useState<string | null>(null)
  const [menuWidth, setMenuWidth] = useState(240)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!(open && menuRef.current)) return
    const anchor = menuRef.current
    setMenuWidth(anchor.offsetLeft + anchor.offsetWidth)
  }, [open])

  const createAssignedThread = async (branchName: string | null) => {
    await createThreadForBranch({ branchName, onAction, projectId })
    setOpen(false)
  }

  const createThreadOnNewBranch = async () => {
    const branchName = newBranchName.trim()
    if (!branchName) return
    if (dirtyMessage) {
      setNewBranchError(dirtyMessage)
      return
    }
    setNewBranchError(null)
    const switchResult = await onAction('workspace.switch-branch', {
      projectId,
      value: branchName,
    })
    const switchError = switchResult?.result?.error
    if (!switchResult?.ok || switchError) {
      setNewBranchError(
        typeof switchError === 'string' && switchError.trim().length > 0
          ? switchError
          : 'Could not create branch.',
      )
      return
    }
    await createThreadForBranch({ branchName, onAction, projectId })
    setNewBranchName('')
    setNewBranchError(null)
    setOpen(false)
  }

  return (
    <div ref={menuRef} className="sidebar-new-thread-menu-anchor">
      <IconButton
        label="New thread"
        icon={<Plus size={14} />}
        tooltipPlacement="right"
        className="h-7 w-7 rounded-md"
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div
          className="sidebar-menu-surface sidebar-menu-surface--below-normal sidebar-new-thread-menu"
          style={{ width: `${menuWidth}px` }}
          role="menu"
          aria-label="New thread options"
        >
          <button
            type="button"
            className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-new-thread-option"
            onClick={() => void createAssignedThread(currentBranch)}
            disabled={!currentBranch}
          >
            <GitBranch size={12} />
            <span className="truncate">Current branch</span>
            <span className="sidebar-new-thread-option-meta truncate">
              {currentBranch ?? 'No branch'}
            </span>
          </button>

          <div className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-new-thread-branch-create">
            <GitBranch size={12} />
            <input
              value={newBranchName}
              onChange={(event) => {
                setNewBranchName(event.target.value)
                setNewBranchError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void createThreadOnNewBranch()
                if (event.key === 'Escape') setOpen(false)
              }}
              placeholder="New branch"
              aria-label="New branch name"
            />
            <button
              type="button"
              data-warning={newBranchError || dirtyMessage ? 'true' : 'false'}
              onClick={() => void createThreadOnNewBranch()}
              disabled={newBranchName.trim().length === 0}
            >
              {newBranchError || dirtyMessage ? (newBranchError ?? dirtyMessage) : 'Create'}
            </button>
          </div>

          <button
            type="button"
            className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-new-thread-option"
            disabled
          >
            <GitFork size={12} />
            <span className="truncate">New worktree</span>
            <span className="sidebar-new-thread-option-meta">Soon</span>
          </button>

          <button
            type="button"
            className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-new-thread-option"
            onClick={() => void createAssignedThread(null)}
          >
            <X size={12} />
            <span className="truncate">Unassigned</span>
            <span className="sidebar-new-thread-option-meta">No branch</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
