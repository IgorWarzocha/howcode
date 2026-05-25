import { IconButton } from '@howcode/common/icon-button'
import { GitBranch, GitFork, Plus, X } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

function focusInput(input: HTMLInputElement | null) {
  input?.focus()
  input?.select()
}

function CreateTargetRow({
  icon,
  inputRef,
  value,
  error,
  placeholder,
  inputLabel,
  createLabel,
  onChange,
  onCreate,
  onClose,
}: {
  icon: ReactNode
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  error: string | null
  placeholder: string
  inputLabel: string
  createLabel: string
  onChange: (value: string) => void
  onCreate: () => void
  onClose: () => void
}) {
  const actionLabel = error ?? createLabel
  return (
    <div
      className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-new-thread-branch-create"
      onPointerUp={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        focusInput(inputRef.current)
      }}
    >
      {icon}
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onCreate()
          if (event.key === 'Escape') onClose()
        }}
        placeholder={placeholder}
        aria-label={inputLabel}
      />
      <button
        type="button"
        data-warning={error ? 'true' : 'false'}
        aria-label={actionLabel}
        title={actionLabel}
        onClick={() => {
          if (value.trim().length === 0) {
            focusInput(inputRef.current)
            return
          }
          onCreate()
        }}
      >
        {error ?? <Plus size={12} />}
      </button>
    </div>
  )
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
  const [newWorktreeBranchName, setNewWorktreeBranchName] = useState('')
  const [newWorktreeError, setNewWorktreeError] = useState<string | null>(null)
  const [menuWidth, setMenuWidth] = useState(240)
  const [menuRight, setMenuRight] = useState(0)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const newBranchInputRef = useRef<HTMLInputElement | null>(null)
  const newWorktreeInputRef = useRef<HTMLInputElement | null>(null)

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
    const row = anchor.closest(
      '.sidebar-project-work-project-block-heading-row, .sidebar-project-work-section-heading',
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

  const createAssignedThread = async (branchName: string | null) => {
    await createThreadForBranch({ branchName, onAction, projectId })
    setOpen(false)
  }

  const createThreadInNewWorktree = async () => {
    const branchName = newWorktreeBranchName.trim()
    if (!branchName) return
    setNewWorktreeError(null)
    const worktreeResult = await onAction('workspace.create-worktree', {
      projectId,
      branchName,
    })
    const worktreeError = worktreeResult?.result?.error
    if (!worktreeResult?.ok || worktreeError || !worktreeResult.result?.projectId) {
      setNewWorktreeError(
        typeof worktreeError === 'string' && worktreeError.trim().length > 0
          ? worktreeError
          : 'Could not create worktree.',
      )
      return
    }

    await createThreadForBranch({
      branchName,
      onAction,
      projectId: worktreeResult.result.projectId,
    })
    setNewWorktreeBranchName('')
    setNewWorktreeError(null)
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
          style={{ right: `${menuRight}px`, width: `${menuWidth}px` }}
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

          <CreateTargetRow
            icon={<GitBranch size={12} />}
            inputRef={newBranchInputRef}
            value={newBranchName}
            error={newBranchError ?? dirtyMessage}
            placeholder="New branch"
            inputLabel="New branch name"
            createLabel="Create branch"
            onChange={(value) => {
              setNewBranchName(value)
              setNewBranchError(null)
            }}
            onCreate={() => void createThreadOnNewBranch()}
            onClose={() => setOpen(false)}
          />

          <CreateTargetRow
            icon={<GitFork size={12} />}
            inputRef={newWorktreeInputRef}
            value={newWorktreeBranchName}
            error={newWorktreeError}
            placeholder="New worktree"
            inputLabel="New worktree branch name"
            createLabel="Create worktree"
            onChange={(value) => {
              setNewWorktreeBranchName(value)
              setNewWorktreeError(null)
            }}
            onCreate={() => void createThreadInNewWorktree()}
            onClose={() => setOpen(false)}
          />

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
