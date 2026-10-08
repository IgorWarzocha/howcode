import { GitBranch, Plus, X } from 'lucide-react'
import { type ReactNode, type RefObject, useRef, useState } from 'react'
import { ActivitySpinner } from '../../../../../src/app/common/activity-spinner'
import { IconButton } from '../../../../../src/app/common/icon-button'
import { Tooltip } from '../../../../../src/app/common/tooltip'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import { WorktreeSmallIcon } from '../../../../../src/app/ui/icons/worktree-small-icon'
import { createChatForBranch, createChatInWorktreeForBranch } from './new-chat-actions'
import { useDirectoryWorkRowMenu } from './useDirectoryWorkRowMenu'

function focusInput(input: HTMLInputElement | null) {
  input?.focus()
  input?.select()
}

function getChatCreationError(actionResult: Awaited<ReturnType<typeof createChatForBranch>>) {
  const chatError = actionResult?.result?.error
  if (actionResult?.ok && !chatError) return null
  return typeof chatError === 'string' && chatError.trim().length > 0
    ? chatError
    : 'Could not start chat.'
}

function PendingMenuIcon({ icon, pending }: { icon: ReactNode; pending: boolean }) {
  return pending ? <ActivitySpinner className="h-3 w-3 text-current" /> : icon
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
  pending = false,
  disabled = false,
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
  pending?: boolean
  disabled?: boolean
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
          if (event.key === 'Enter' && !(pending || disabled)) onCreate()
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
          disabled={pending || disabled}
          onClick={() => {
            if (pending || disabled) return
            if (value.trim().length === 0) {
              focusInput(inputRef.current)
              return
            }
            onCreate()
          }}
        >
          {pending ? (
            <ActivitySpinner className="h-3 w-3 text-current" />
          ) : (
            (error ?? <Plus size={12} />)
          )}
        </button>
      </Tooltip>
    </div>
  )
}

export function NewChatMenu({
  currentBranch,
  isGitRepo = true,
  onAction,
  directoryId,
}: {
  currentBranch: string | null
  isGitRepo?: boolean
  onAction: DesktopActionInvoker
  directoryId: string
}) {
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchError, setNewBranchError] = useState<string | null>(null)
  const [newWorktreeBranchName, setNewWorktreeBranchName] = useState('')
  const [newWorktreeError, setNewWorktreeError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<
    'current' | 'branch' | 'worktree' | 'unassigned' | null
  >(null)
  const newBranchInputRef = useRef<HTMLInputElement | null>(null)
  const newWorktreeInputRef = useRef<HTMLInputElement | null>(null)
  const menu = useDirectoryWorkRowMenu('directory')

  const createAssignedChat = async (
    branchName: string | null,
    action: 'current' | 'unassigned',
  ) => {
    setPendingAction(action)
    try {
      await createChatForBranch({ branchName, onAction, directoryId })
      menu.setOpen(false)
    } finally {
      setPendingAction(null)
    }
  }

  const toggleOpen = () => {
    menu.setOpen((current) => !current)
  }

  const createChatInNewWorktree = async () => {
    const branchName = newWorktreeBranchName.trim()
    if (!branchName) return
    setNewWorktreeError(null)
    setPendingAction('worktree')
    try {
      const result = await createChatInWorktreeForBranch({
        branchName,
        onAction,
        directoryId,
      })
      if (result.error) {
        setNewWorktreeError(result.error)
        return
      }
      setNewWorktreeBranchName('')
      setNewWorktreeError(null)
      menu.setOpen(false)
    } finally {
      setPendingAction(null)
    }
  }

  const createChatOnNewBranch = async () => {
    const branchName = newBranchName.trim()
    if (!branchName) return
    setNewBranchError(null)
    setPendingAction('branch')
    try {
      const switchResult = await onAction('coding.switch-branch', {
        directoryId,
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
      const normalizedBranchName = switchResult.result?.branchName ?? branchName
      const chatResult = await createChatForBranch({
        branchName: normalizedBranchName,
        onAction,
        directoryId,
      })
      const chatCreationError = getChatCreationError(chatResult)
      if (chatCreationError) {
        setNewBranchError(chatCreationError)
        return
      }
      setNewBranchName('')
      setNewBranchError(null)
      menu.setOpen(false)
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="sidebar-new-thread-menu-anchor">
      <IconButton
        ref={menu.triggerRef}
        label="New chat"
        icon={<Plus size={14} />}
        tooltipPlacement="right"
        className="h-7 w-7 rounded-md"
        onClick={toggleOpen}
      />
      {menu.open ? (
        <div
          ref={menu.panelRef}
          className="sidebar-menu-surface sidebar-menu-surface--below-normal sidebar-new-thread-menu"
          style={{ right: `${menu.right}px`, width: `${menu.width}px` }}
          role="menu"
          aria-label="New chat options"
        >
          {isGitRepo ? null : (
            <button
              type="button"
              className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-new-thread-option"
              onClick={() => void createAssignedChat(null, 'unassigned')}
              disabled={pendingAction !== null}
            >
              <PendingMenuIcon icon={<Plus size={11} />} pending={pendingAction === 'unassigned'} />
              <span className="truncate">New chat</span>
            </button>
          )}

          {isGitRepo ? (
            <>
              <button
                type="button"
                className="sidebar-menu-item sidebar-new-thread-option sidebar-new-thread-current-branch-option"
                onClick={() => void createAssignedChat(currentBranch, 'current')}
                disabled={!currentBranch || pendingAction !== null}
              >
                <span className="sidebar-new-thread-current-branch-icon" aria-hidden="true">
                  <PendingMenuIcon
                    icon={<GitBranch size={11} />}
                    pending={pendingAction === 'current'}
                  />
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
                onCreate={() => void createChatOnNewBranch()}
                onClose={() => menu.setOpen(false)}
                pending={pendingAction === 'branch'}
                disabled={pendingAction !== null}
              />

              <CreateTargetRow
                icon={<WorktreeSmallIcon size={11} />}
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
                onCreate={() => void createChatInNewWorktree()}
                onClose={() => menu.setOpen(false)}
                pending={pendingAction === 'worktree'}
                disabled={pendingAction !== null}
              />

              <button
                type="button"
                className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-new-thread-option"
                onClick={() => void createAssignedChat(null, 'unassigned')}
                disabled={pendingAction !== null}
              >
                <PendingMenuIcon icon={<X size={11} />} pending={pendingAction === 'unassigned'} />
                <span className="truncate">Unassigned</span>
                <Tooltip content="Start outside git" placement="right">
                  <span className="sidebar-new-thread-option-meta sidebar-new-thread-option-plus">
                    <Plus size={12} />
                  </span>
                </Tooltip>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
