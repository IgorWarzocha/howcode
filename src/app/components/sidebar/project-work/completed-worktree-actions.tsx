import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { GitMerge, Trash2 } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'
import { SidebarActionTooltip } from '../sidebar-action-tooltip'
import { SidebarInlineConfirmPopunder } from '../sidebar-inline-confirm-popunder'
import type { BranchThreadGroup } from './branch-group-model'
import { getDesktopBranchActionFailure, useBranchActionExecution } from './useBranchActionExecution'

function getCompletedWorktreeTargets(
  group: BranchThreadGroup,
  options: { requireBranch?: boolean } = {},
) {
  const completedWorktrees = group.worktrees.filter((worktree) => worktree.complete)
  return completedWorktrees.flatMap((worktree) =>
    !options.requireBranch || worktree.branchName ? [{ worktreePath: worktree.path }] : [],
  )
}

function getCompletedWorktreeFailureLabel(
  group: BranchThreadGroup,
  failedWorktreePath: string | undefined,
  failedWorktreeBranchName: string | null | undefined,
) {
  const completedWorktrees = group.worktrees.filter((worktree) => worktree.complete)
  const failedWorktree = completedWorktrees.find((worktree) => worktree.path === failedWorktreePath)
  return failedWorktree?.label ?? failedWorktreeBranchName ?? failedWorktreePath ?? 'a worktree'
}

type CompletedWorktreeActionProps = {
  group: BranchThreadGroup
  project: Project
  confirming: boolean
  onAction: DesktopActionInvoker
  onCancel: () => void
  onConfirm: () => void
  onRequestConfirm: () => void
}

export function MergeCompletedWorktreesAction({
  group,
  project,
  confirming,
  onAction,
  onCancel,
  onConfirm,
  onRequestConfirm,
}: CompletedWorktreeActionProps) {
  const execution = useBranchActionExecution()
  const worktrees = getCompletedWorktreeTargets(group, { requireBranch: true })
  if (worktrees.length === 0) return null

  const mergeCompleted = async () => {
    execution.clearWarning()
    onCancel()
    await execution.run({
      execute: () =>
        onAction('workspace.merge-completed-worktrees', {
          rootProjectId: project.id,
          worktrees,
        }),
      getFailure: (result) => {
        if (!getDesktopBranchActionFailure(result, 'Could not merge completed worktrees.')) {
          return null
        }
        const failureLabel = getCompletedWorktreeFailureLabel(
          group,
          result?.result?.failedWorktreePath,
          result?.result?.failedWorktreeBranchName,
        )
        return `${failureLabel} did not merge. Start a session on the parent branch to resolve it.`
      },
      onSuccess: onConfirm,
    })
  }

  const tooltipContent = execution.pending
    ? 'Merging completed worktrees…'
    : 'Merge completed worktrees'
  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-merge-action${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
      data-warning={execution.warning ? 'true' : 'false'}
      disabled={execution.pending}
      onClick={(event) => {
        event.stopPropagation()
        execution.clearWarning()
        onRequestConfirm()
      }}
      aria-label={`Merge completed worktrees under ${group.label}`}
    >
      {execution.pending ? (
        <ActivitySpinner className="h-3 w-3 text-current" />
      ) : (
        <GitMerge size={12} />
      )}
    </button>
  )

  if (confirming) {
    return (
      <SidebarInlineConfirmPopunder
        open={confirming}
        trigger={actionButton}
        confirmAriaLabel={`Merge completed worktrees under ${group.label}`}
        confirmIcon={<GitMerge size={12} />}
        onCancel={onCancel}
        onConfirm={() => void mergeCompleted()}
      />
    )
  }

  return (
    <SidebarActionTooltip description={tooltipContent} warning={execution.warning}>
      {actionButton}
    </SidebarActionTooltip>
  )
}

export function RemoveCompletedWorktreesAction({
  group,
  project,
  confirming,
  onAction,
  onCancel,
  onConfirm,
  onRequestConfirm,
}: CompletedWorktreeActionProps) {
  const execution = useBranchActionExecution()
  const worktrees = getCompletedWorktreeTargets(group)
  if (worktrees.length === 0) return null

  const removeCompleted = async () => {
    execution.clearWarning()
    onCancel()
    await execution.run({
      execute: () =>
        onAction('workspace.remove-completed-worktrees', {
          rootProjectId: project.id,
          worktrees,
        }),
      getFailure: (result) =>
        getDesktopBranchActionFailure(result, 'Could not remove completed worktrees.'),
      onSuccess: onConfirm,
    })
  }

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up${confirming || execution.warning ? ' sidebar-project-work-branch-action--danger' : ''}`}
      data-warning={execution.warning ? 'true' : 'false'}
      onClick={(event) => {
        event.stopPropagation()
        execution.clearWarning()
        onRequestConfirm()
      }}
      aria-label={`Remove completed worktrees under ${group.label}`}
      disabled={execution.pending}
    >
      {execution.pending ? (
        <ActivitySpinner className="h-3 w-3 text-current" />
      ) : (
        <Trash2 size={12} />
      )}
    </button>
  )

  if (confirming) {
    return (
      <SidebarInlineConfirmPopunder
        open={confirming}
        trigger={actionButton}
        confirmAriaLabel={`Remove completed worktrees under ${group.label}`}
        confirmIcon={<Trash2 size={12} />}
        onCancel={onCancel}
        onConfirm={() => void removeCompleted()}
      />
    )
  }

  return (
    <SidebarActionTooltip description="Remove completed worktrees" warning={execution.warning}>
      {actionButton}
    </SidebarActionTooltip>
  )
}
