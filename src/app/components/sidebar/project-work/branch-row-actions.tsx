import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { Tooltip } from '@howcode/common/tooltip'
import { GitFork, Plus } from 'lucide-react'
import type { RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'
import { SidebarActionTooltip } from '../sidebar-action-tooltip'
import {
  BranchPruneAction,
  BranchSwitchAction,
  MergeCompletedWorktreesAction,
  RemoveCompletedWorktreesAction,
  WorktreeCompletionAction,
  WorktreeMergeAction,
} from './branch-actions'
import { createThreadForBranch, createThreadInWorktreeForBranch } from './new-thread-menu'
import type { BranchThreadGroup } from './project-work-model'

function getStartThreadBranchName(group: BranchThreadGroup, currentBranch: string | null) {
  if (group.current) return currentBranch
  if (group.unassigned) return null
  if (group.worktree) return group.worktreeBranchName ?? null
  return group.label
}

export function getWorktreeParentBranchName(
  group: BranchThreadGroup,
  currentBranch: string | null,
) {
  if (group.current) return currentBranch?.trim() || group.label
  if (group.worktree || group.unassigned) return null
  return group.label
}

function BranchStartMenu({
  group,
  inputRef,
  parentBranchName,
  worktreeBranchName,
  worktreeError,
  menuRight,
  menuWidth,
  onCreateChildWorktree,
  onClose,
  onWorktreeBranchNameChange,
  pending = false,
}: {
  group: BranchThreadGroup
  inputRef: RefObject<HTMLInputElement | null>
  parentBranchName: string | null
  worktreeBranchName: string
  worktreeError: string | null
  menuRight: number
  menuWidth: number
  onCreateChildWorktree: () => void
  onClose: () => void
  onWorktreeBranchNameChange: (value: string) => void
  pending?: boolean
}) {
  return (
    <div
      className="sidebar-menu-surface sidebar-menu-surface--below-normal sidebar-new-thread-menu"
      style={{ right: `${menuRight}px`, width: `${menuWidth}px` }}
      role="menu"
      aria-label={`New work on ${parentBranchName ?? group.label}`}
    >
      <div className="sidebar-menu-item sidebar-menu-item--with-meta sidebar-new-thread-branch-create">
        <GitFork size={11} />
        <input
          ref={inputRef}
          value={worktreeBranchName}
          onChange={(event) => onWorktreeBranchNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !pending) onCreateChildWorktree()
            if (event.key === 'Escape') onClose()
          }}
          placeholder="New worktree"
          aria-label="New worktree branch name"
        />
        <button
          type="button"
          data-warning={worktreeError ? 'true' : 'false'}
          className="sidebar-new-thread-option-meta sidebar-new-thread-option-plus"
          aria-label={worktreeError ?? 'Create worktree'}
          disabled={pending}
          onClick={() => {
            if (!pending) onCreateChildWorktree()
          }}
        >
          {pending ? (
            <ActivitySpinner className="h-3 w-3 text-current" />
          ) : (
            (worktreeError ?? <Plus size={12} />)
          )}
        </button>
      </div>
    </div>
  )
}

function BranchWorktreeCreateAction({
  currentBranch,
  group,
  project,
  onAction,
  onCreateFailed,
}: {
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
  onCreateFailed: () => void
}) {
  const [open, setOpen] = useState(false)
  const [worktreeBranchName, setWorktreeBranchName] = useState('')
  const [worktreeError, setWorktreeError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [menuWidth, setMenuWidth] = useState(240)
  const [menuRight, setMenuRight] = useState(0)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const parentBranchName = getWorktreeParentBranchName(group, currentBranch)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    inputRef.current?.select()
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
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
    if (!(open && buttonRef.current)) return
    const anchor = buttonRef.current
    const row = anchor.closest('.sidebar-project-work-branch-heading')
    const rowRect = row?.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    if (!rowRect) {
      setMenuWidth(240)
      setMenuRight(0)
      return
    }
    setMenuWidth(rowRect.width)
    setMenuRight(anchorRect.right - rowRect.right)
  }, [open])

  const createChildWorktree = async () => {
    const branchName = worktreeBranchName.trim()
    if (!branchName) return
    setWorktreeError(null)
    setPending(true)
    try {
      const result = await createThreadInWorktreeForBranch({
        branchName,
        parentBranchName,
        onAction,
        projectId: project.id,
      })
      if (result.error) {
        setWorktreeError(result.error)
        onCreateFailed()
        return
      }
      setWorktreeBranchName('')
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Tooltip
      content={`Create worktree under ${parentBranchName ?? group.label}`}
      placement="right"
      className="sidebar-new-thread-menu-anchor"
    >
      <button
        ref={buttonRef}
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        aria-label={`Create worktree under ${parentBranchName ?? group.label}`}
        aria-expanded={open}
      >
        <GitFork size={12} />
      </button>
      {open ? (
        <div ref={menuRef}>
          <BranchStartMenu
            group={group}
            inputRef={inputRef}
            parentBranchName={parentBranchName}
            worktreeBranchName={worktreeBranchName}
            worktreeError={worktreeError}
            menuRight={menuRight}
            menuWidth={menuWidth}
            onCreateChildWorktree={() => void createChildWorktree()}
            onClose={() => setOpen(false)}
            pending={pending}
            onWorktreeBranchNameChange={(value) => {
              setWorktreeBranchName(value)
              setWorktreeError(null)
            }}
          />
        </div>
      ) : null}
    </Tooltip>
  )
}

function EmptyBranchStartAction({
  blocked,
  canSwitch,
  currentBranch,
  group,
  project,
  onAction,
  onSwitchFailed,
}: {
  blocked: boolean
  canSwitch: boolean
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
  onSwitchFailed: () => void
}) {
  const targetProjectId = group.worktreePath ?? project.id
  const [pending, setPending] = useState(false)
  const startThread = async () => {
    setPending(true)
    try {
      if (!(group.current || group.worktree || group.unassigned)) {
        const worktreeResult = await createThreadInWorktreeForBranch({
          branchName: group.label,
          parentBranchName: currentBranch,
          onAction,
          projectId: project.id,
        })
        if (worktreeResult.error) onSwitchFailed()
        return
      }

      await createThreadForBranch({
        branchName: getStartThreadBranchName(group, currentBranch),
        onAction,
        projectId: targetProjectId,
      })
    } finally {
      setPending(false)
    }
  }

  const label = group.worktree
    ? `Start thread in ${group.label}`
    : group.current
      ? `Start thread on ${currentBranch ?? group.label}`
      : group.unassigned
        ? 'Start unassigned thread'
        : `Start thread in ${group.label} worktree`
  const tooltipContent = canSwitch ? 'Switch branches and start a new session.' : label
  const warning = blocked
    ? 'You have uncommitted changes on your current branch. Commit first.'
    : null

  return (
    <SidebarActionTooltip description={tooltipContent} warning={warning}>
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-empty-start"
        data-warning={blocked ? 'true' : 'false'}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation()
          void startThread()
        }}
        aria-label={label}
      >
        {pending ? <ActivitySpinner className="h-3 w-3 text-current" /> : <Plus size={12} />}
      </button>
    </SidebarActionTooltip>
  )
}

export function BranchInlineActions({
  canPrune,
  canSwitch,
  canToggleWorktreeComplete,
  canMergeWorktree,
  canMergeCompletedWorktrees,
  canRemoveCompletedWorktrees,
  canCreateWorktree,
  confirmingPrune,
  confirmingMergeCompletedWorktrees,
  confirmingRemoveCompletedWorktrees,
  currentBranch,
  group,
  project,
  switchBlocked,
  onAction,
  onCancelPrune,
  onConfirmPrune,
  onRequestPruneConfirm,
  onCancelMergeCompletedWorktrees,
  onConfirmMergeCompletedWorktrees,
  onRequestMergeCompletedWorktreesConfirm,
  onCancelRemoveCompletedWorktrees,
  onConfirmRemoveCompletedWorktrees,
  onRequestRemoveCompletedWorktreesConfirm,
  onSwitchBlocked,
  onSwitchFailed,
}: {
  canPrune: boolean
  canSwitch: boolean
  canToggleWorktreeComplete: boolean
  canMergeWorktree: boolean
  canMergeCompletedWorktrees: boolean
  canRemoveCompletedWorktrees: boolean
  canCreateWorktree: boolean
  confirmingPrune: boolean
  confirmingMergeCompletedWorktrees: boolean
  confirmingRemoveCompletedWorktrees: boolean
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  switchBlocked: boolean
  onAction: DesktopActionInvoker
  onCancelPrune: () => void
  onConfirmPrune: () => void
  onRequestPruneConfirm: () => void
  onCancelMergeCompletedWorktrees: () => void
  onConfirmMergeCompletedWorktrees: () => void
  onRequestMergeCompletedWorktreesConfirm: () => void
  onCancelRemoveCompletedWorktrees: () => void
  onConfirmRemoveCompletedWorktrees: () => void
  onRequestRemoveCompletedWorktreesConfirm: () => void
  onSwitchBlocked: () => void
  onSwitchFailed: () => void
}) {
  return (
    <>
      {canPrune ? (
        <BranchPruneAction
          confirming={confirmingPrune}
          group={group}
          project={project}
          onAction={onAction}
          onCancel={onCancelPrune}
          onConfirm={onConfirmPrune}
          onRequestConfirm={onRequestPruneConfirm}
        />
      ) : null}
      {canRemoveCompletedWorktrees ? (
        <RemoveCompletedWorktreesAction
          confirming={confirmingRemoveCompletedWorktrees}
          group={group}
          project={project}
          onAction={onAction}
          onCancel={onCancelRemoveCompletedWorktrees}
          onConfirm={onConfirmRemoveCompletedWorktrees}
          onRequestConfirm={onRequestRemoveCompletedWorktreesConfirm}
        />
      ) : null}
      {canMergeCompletedWorktrees ? (
        <MergeCompletedWorktreesAction
          confirming={confirmingMergeCompletedWorktrees}
          group={group}
          project={project}
          onAction={onAction}
          onCancel={onCancelMergeCompletedWorktrees}
          onConfirm={onConfirmMergeCompletedWorktrees}
          onRequestConfirm={onRequestMergeCompletedWorktreesConfirm}
        />
      ) : null}
      {canSwitch ? (
        <BranchSwitchAction
          blocked={switchBlocked}
          group={group}
          project={project}
          onAction={onAction}
          onBlocked={onSwitchBlocked}
          onSwitchFailed={onSwitchFailed}
        />
      ) : null}
      {canToggleWorktreeComplete ? (
        <WorktreeCompletionAction group={group} project={project} onAction={onAction} />
      ) : null}
      {canMergeWorktree ? (
        <WorktreeMergeAction group={group} project={project} onAction={onAction} />
      ) : null}
      {canCreateWorktree ? (
        <BranchWorktreeCreateAction
          currentBranch={currentBranch}
          group={group}
          project={project}
          onAction={onAction}
          onCreateFailed={onSwitchFailed}
        />
      ) : null}
      <EmptyBranchStartAction
        blocked={switchBlocked}
        canSwitch={canSwitch}
        currentBranch={currentBranch}
        group={group}
        project={project}
        onAction={onAction}
        onSwitchFailed={onSwitchFailed}
      />
    </>
  )
}

export function BranchSessionCount({ count, hidden }: { count: number; hidden: boolean }) {
  return hidden ? null : <span className="sidebar-project-work-branch-count">{count}</span>
}
