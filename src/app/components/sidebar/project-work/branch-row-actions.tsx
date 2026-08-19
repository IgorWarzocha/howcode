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
import { getDesktopBranchActionFailure, useBranchActionExecution } from './useBranchActionExecution'
import { useProjectWorkRowMenu } from './useProjectWorkRowMenu'

function getStartThreadBranchName(group: BranchThreadGroup, currentBranch: string | null) {
  if (group.kind === 'unassigned') return null
  if (group.kind === 'worktree') return group.worktreeBranchName
  if (group.current) return currentBranch
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
  const execution = useBranchActionExecution()
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
    execution.clearWarning()
    await execution.run({
      execute: () =>
        createThreadInWorktreeForBranch({
          branchName,
          onAction,
          projectId: project.id,
        }),
      getFailure: (result) => result.error ?? null,
      onSuccess: () => {
        setWorktreeBranchName('')
        menu.setOpen(false)
      },
    })
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
            worktreeError={execution.warning}
            menuRight={menu.right}
            menuWidth={menu.width}
            onCreateChildWorktree={() => void createChildWorktree()}
            onClose={() => menu.setOpen(false)}
            pending={execution.pending}
            onWorktreeBranchNameChange={(value) => {
              setWorktreeBranchName(value)
              execution.clearWarning()
            }}
          />
        </div>
      ) : null}
    </Tooltip>
  )
}

function BranchStartThreadAction({
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
  const targetProjectId = group.kind === 'worktree' ? group.worktreePath : project.id
  const execution = useBranchActionExecution()
  const startThread = async () => {
    execution.clearWarning()
    if (group.kind === 'branch' && !group.current) {
      await execution.run({
        execute: () =>
          createThreadInWorktreeForBranch({
            branchName: group.label,
            onAction,
            projectId: project.id,
          }),
        getFailure: (result) => result.error ?? null,
      })
      return
    }

    await execution.run({
      execute: () =>
        createThreadForBranch({
          branchName: getStartThreadBranchName(group, currentBranch),
          onAction,
          projectId: targetProjectId,
        }),
      getFailure: (result) =>
        getDesktopBranchActionFailure(result, 'Could not start a new session.'),
    })
  }

  const label =
    group.kind === 'worktree'
      ? `Start thread in ${group.label}`
      : group.kind === 'unassigned'
        ? 'Start unassigned thread'
        : group.current
          ? `Start thread on ${currentBranch ?? group.label}`
          : `Start thread in ${group.label} worktree`
  const tooltipContent = canSwitch ? `Start thread in ${group.label} worktree` : label
  const warning = execution.warning ?? (blocked ? 'Worktree is dirty. Commit first.' : null)

  return (
    <SidebarActionTooltip description={tooltipContent} warning={warning}>
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-empty-start"
        data-warning={warning ? 'true' : 'false'}
        disabled={execution.pending}
        onClick={(event) => {
          event.stopPropagation()
          if (blocked) return
          void startThread()
        }}
        aria-label={label}
      >
        {execution.pending ? (
          <ActivitySpinner className="h-3 w-3 text-current" />
        ) : (
          <Plus size={12} />
        )}
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
      {capabilities.canStartThread ? (
        <BranchStartThreadAction
          blocked={switchBlocked}
          canSwitch={capabilities.canSwitch}
          currentBranch={currentBranch}
          group={group}
          project={project}
          onAction={onAction}
        />
      ) : null}
    </span>
  )
}

export function BranchSessionCount({ count, hidden }: { count: number; hidden: boolean }) {
  return hidden ? null : <span className="sidebar-project-work-branch-count">{count}</span>
}
