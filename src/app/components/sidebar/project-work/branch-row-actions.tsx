import { Tooltip } from '@howcode/common/tooltip'
import { Plus } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'
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
  return group.label
}

function EmptyBranchStartAction({
  blocked,
  currentBranch,
  group,
  project,
  onAction,
  onSwitchFailed,
}: {
  blocked: boolean
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
  onSwitchFailed: () => void
}) {
  const targetProjectId = group.worktreePath ?? project.id
  const startThread = async () => {
    if (!(group.current || group.worktree || group.unassigned)) {
      const worktreeResult = await createThreadInWorktreeForBranch({
        branchName: group.label,
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
  }

  const label = group.worktree
    ? `Start thread in ${group.label}`
    : group.current
      ? `Start thread on ${currentBranch ?? group.label}`
      : group.unassigned
        ? 'Start unassigned thread'
        : `Start thread in ${group.label} worktree`

  return (
    <Tooltip content={blocked ? 'Worktree is dirty. Commit first.' : label} placement="right">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-empty-start"
        data-warning={blocked ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation()
          void startThread()
        }}
        aria-label={label}
      >
        <Plus size={12} />
      </button>
    </Tooltip>
  )
}

export function BranchInlineActions({
  canPrune,
  canSwitch,
  canToggleWorktreeComplete,
  canMergeWorktree,
  canMergeCompletedWorktrees,
  canRemoveCompletedWorktrees,
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
      <EmptyBranchStartAction
        blocked={switchBlocked}
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
