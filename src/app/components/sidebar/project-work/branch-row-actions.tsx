import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { Tooltip } from '@howcode/common/tooltip'
import { Plus } from 'lucide-react'
import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'
import { WorktreeSmallIcon } from '../../../ui/icons/worktree-small-icon'
import { SidebarActionTooltip } from '../sidebar-action-tooltip'
import { type BranchActionCapabilities, getBranchActionCount } from './branch-action-capabilities'
import {
  BranchPruneAction,
  BranchSwitchAction,
  MergeCompletedWorktreesAction,
  RemoveCompletedWorktreesAction,
  WorktreeCompletionAction,
  WorktreeMergeAction,
} from './branch-actions'
import type { BranchThreadGroup } from './branch-group-model'
import { getWorktreeParentBranchName } from './branch-row-helpers'
import { createThreadForBranch, createThreadInWorktreeForBranch } from './new-thread-actions'
import { useProjectWorkRowMenu } from './useProjectWorkRowMenu'

function getStartThreadBranchName(group: BranchThreadGroup, currentBranch: string | null) {
  if (group.current) return currentBranch
  if (group.unassigned) return null
  if (group.worktree) return group.worktreeBranchName ?? null
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
        <WorktreeSmallIcon size={11} />
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
}: {
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
}) {
  const [worktreeBranchName, setWorktreeBranchName] = useState('')
  const [worktreeError, setWorktreeError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const menu = useProjectWorkRowMenu('branch')
  const parentBranchName = getWorktreeParentBranchName(group, currentBranch)

  useEffect(() => {
    if (!menu.open) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [menu.open])

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
        return
      }
      setWorktreeBranchName('')
      menu.setOpen(false)
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
        ref={menu.triggerRef}
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up"
        onClick={(event) => {
          event.stopPropagation()
          menu.setOpen((current) => !current)
        }}
        aria-label={`Create worktree under ${parentBranchName ?? group.label}`}
        aria-expanded={menu.open}
      >
        <WorktreeSmallIcon size={12} />
      </button>
      {menu.open ? (
        <div ref={menu.panelRef}>
          <BranchStartMenu
            group={group}
            inputRef={inputRef}
            parentBranchName={parentBranchName}
            worktreeBranchName={worktreeBranchName}
            worktreeError={worktreeError}
            menuRight={menu.right}
            menuWidth={menu.width}
            onCreateChildWorktree={() => void createChildWorktree()}
            onClose={() => menu.setOpen(false)}
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
}: {
  blocked: boolean
  canSwitch: boolean
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
}) {
  const targetProjectId = group.worktreePath ?? project.id
  const [pending, setPending] = useState(false)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const startThread = async () => {
    setWarningMessage(null)
    setPending(true)
    try {
      if (!(group.current || group.worktree || group.unassigned)) {
        const worktreeResult = await createThreadInWorktreeForBranch({
          branchName: group.label,
          parentBranchName: currentBranch,
          onAction,
          projectId: project.id,
        })
        if (worktreeResult.error) setWarningMessage(worktreeResult.error)
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
  const warning = warningMessage ?? (blocked ? 'Worktree is dirty. Commit first.' : null)

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

type BranchConfirmation = 'prune' | 'merge-completed' | 'remove-completed' | null

export function BranchInlineActions({
  capabilities,
  currentBranch,
  group,
  project,
  switchBlocked,
  onAction,
}: {
  capabilities: BranchActionCapabilities
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  switchBlocked: boolean
  onAction: DesktopActionInvoker
}) {
  const [confirmation, setConfirmation] = useState<BranchConfirmation>(null)
  const actionCount = getBranchActionCount(capabilities)

  return (
    <span
      className="sidebar-project-work-branch-actions"
      data-action-count={actionCount}
      data-confirming={confirmation === null ? 'false' : 'true'}
    >
      {capabilities.canPrune ? (
        <BranchPruneAction
          confirming={confirmation === 'prune'}
          group={group}
          project={project}
          onAction={onAction}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => setConfirmation(null)}
          onRequestConfirm={() => setConfirmation('prune')}
        />
      ) : null}
      {capabilities.canRemoveCompletedWorktrees ? (
        <RemoveCompletedWorktreesAction
          confirming={confirmation === 'remove-completed'}
          group={group}
          project={project}
          onAction={onAction}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => setConfirmation(null)}
          onRequestConfirm={() => setConfirmation('remove-completed')}
        />
      ) : null}
      {capabilities.canMergeCompletedWorktrees ? (
        <MergeCompletedWorktreesAction
          confirming={confirmation === 'merge-completed'}
          group={group}
          project={project}
          onAction={onAction}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => setConfirmation(null)}
          onRequestConfirm={() => setConfirmation('merge-completed')}
        />
      ) : null}
      {capabilities.canSwitch ? (
        <BranchSwitchAction
          blocked={switchBlocked}
          group={group}
          project={project}
          onAction={onAction}
        />
      ) : null}
      {capabilities.canToggleWorktreeComplete ? (
        <WorktreeCompletionAction group={group} project={project} onAction={onAction} />
      ) : null}
      {capabilities.canMergeWorktree ? (
        <WorktreeMergeAction group={group} project={project} onAction={onAction} />
      ) : null}
      {capabilities.canCreateWorktree ? (
        <BranchWorktreeCreateAction
          currentBranch={currentBranch}
          group={group}
          project={project}
          onAction={onAction}
        />
      ) : null}
      <EmptyBranchStartAction
        blocked={switchBlocked}
        canSwitch={capabilities.canSwitch}
        currentBranch={currentBranch}
        group={group}
        project={project}
        onAction={onAction}
      />
    </span>
  )
}

export function BranchSessionCount({ count, hidden }: { count: number; hidden: boolean }) {
  return hidden ? null : <span className="sidebar-project-work-branch-count">{count}</span>
}
