import { IconButton } from '@howcode/common/icon-button'
import { Tooltip } from '@howcode/common/tooltip'
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
  return await onAction('thread.new', {
    projectId,
    composerMode: 'code',
    branchName,
  })
}

function focusInput(input: HTMLInputElement | null) {
  input?.focus()
  input?.select()
}

export async function createThreadInWorktreeForBranch({
  branchName,
  onAction,
  projectId,
}: {
  branchName: string
  onAction: DesktopActionInvoker
  projectId: string
}) {
  const worktreeResult = await onAction('workspace.create-worktree', { projectId, branchName })
  const worktreeError = worktreeResult?.result?.error
  if (!worktreeResult?.ok || worktreeError || !worktreeResult.result?.projectId) {
    return {
      error:
        typeof worktreeError === 'string' && worktreeError.trim().length > 0
          ? worktreeError
          : 'Could not create worktree.',
    }
  }

  const threadResult = await createThreadForBranch({
    branchName,
    onAction,
    projectId: worktreeResult.result.projectId,
  })
  const threadError = threadResult?.result?.error
  if (!threadResult?.ok || threadError) {
    return {
      error:
        typeof threadError === 'string' && threadError.trim().length > 0
          ? threadError
          : 'Could not start thread.',
    }
  }
  return { didMutate: true }
}

function getThreadCreationError(actionResult: Awaited<ReturnType<typeof createThreadForBranch>>) {
  const threadError = actionResult?.result?.error
  if (actionResult?.ok && !threadError) return null
  return typeof threadError === 'string' && threadError.trim().length > 0
    ? threadError
    : 'Could not start thread.'
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
      <Tooltip content={actionLabel} placement="right" className="sidebar-new-thread-create-action">
        <button
          type="button"
          data-warning={error ? 'true' : 'false'}
          className="sidebar-new-thread-option-meta sidebar-new-thread-option-plus"
          aria-label={actionLabel}
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
      </Tooltip>
    </div>
  )
}

export function NewThreadMenu({
  currentBranch,
  onAction,
  projectId,
}: {
  currentBranch: string | null
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
      event.stopImmediatePropagation()
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
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

  const toggleOpen = () => {
    setOpen((current) => !current)
  }

  const createThreadInNewWorktree = async () => {
    const branchName = newWorktreeBranchName.trim()
    if (!branchName) return
    setNewWorktreeError(null)
    const result = await createThreadInWorktreeForBranch({ branchName, onAction, projectId })
    if (result.error) {
      setNewWorktreeError(result.error)
      return
    }
    setNewWorktreeBranchName('')
    setNewWorktreeError(null)
    setOpen(false)
  }

  const createThreadOnNewBranch = async () => {
    const branchName = newBranchName.trim()
    if (!branchName) return
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
    const threadResult = await createThreadForBranch({ branchName, onAction, projectId })
    const threadCreationError = getThreadCreationError(threadResult)
    if (threadCreationError) {
      setNewBranchError(threadCreationError)
      return
    }
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
        onClick={toggleOpen}
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
            className="sidebar-menu-item sidebar-new-thread-option sidebar-new-thread-current-branch-option"
            onClick={() => void createAssignedThread(currentBranch)}
            disabled={!currentBranch}
          >
            <span className="sidebar-new-thread-current-branch-icon" aria-hidden="true">
              <GitBranch size={11} />
            </span>
            <span className="truncate">{currentBranch ?? 'No branch'}</span>
          </button>

          <CreateTargetRow
            icon={<GitBranch size={11} />}
            inputRef={newBranchInputRef}
            value={newBranchName}
            error={newBranchError}
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
            icon={<GitFork size={11} />}
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
            <X size={11} />
            <span className="truncate">Unassigned</span>
            <Tooltip content="Start outside git" placement="right">
              <span className="sidebar-new-thread-option-meta sidebar-new-thread-option-plus">
                <Plus size={12} />
              </span>
            </Tooltip>
          </button>
        </div>
      ) : null}
    </div>
  )
}
