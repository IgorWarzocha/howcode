import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { GitBranch, XSquare } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'
import { SidebarActionTooltip } from '../sidebar-action-tooltip'
import { SidebarInlineConfirmPopunder } from '../sidebar-inline-confirm-popunder'
import type { BranchThreadGroup } from './branch-group-model'
import { getDesktopBranchActionFailure, useBranchActionExecution } from './useBranchActionExecution'

export function BranchSwitchAction({
  blocked,
  group,
  project,
  onAction,
}: {
  blocked: boolean
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
}) {
  const execution = useBranchActionExecution()
  const warning = execution.warning ?? (blocked ? 'Worktree is dirty. Commit first.' : null)
  const hasWarning = Boolean(warning)
  const switchBranch = async () => {
    execution.clearWarning()
    await execution.run({
      execute: () =>
        onAction('workspace.switch-branch', {
          projectId: project.id,
          value: group.label,
        }),
      getFailure: (result) => getDesktopBranchActionFailure(result, 'Could not switch branch.'),
    })
  }
  return (
    <SidebarActionTooltip description={`Switch to ${group.label}`} warning={warning}>
      <button
        type="button"
        className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action${hasWarning ? ' sidebar-project-work-branch-action--danger' : ''}`}
        data-warning={hasWarning ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation()
          if (blocked) return
          void switchBranch()
        }}
        aria-label={`Switch to ${group.label}`}
        disabled={execution.pending}
      >
        {execution.pending ? (
          <ActivitySpinner className="h-3 w-3 text-current" />
        ) : (
          <GitBranch size={12} />
        )}
      </button>
    </SidebarActionTooltip>
  )
}

export function BranchPruneAction({
  group,
  project,
  confirming,
  onAction,
  onCancel,
  onConfirm,
  onRequestConfirm,
}: {
  group: BranchThreadGroup
  project: Project
  confirming: boolean
  onAction: DesktopActionInvoker
  onCancel: () => void
  onConfirm: () => void
  onRequestConfirm: () => void
}) {
  const execution = useBranchActionExecution()
  const worktreesToRemove = group.worktreePath
    ? []
    : [...group.worktrees, ...(group.completedWorktrees ?? [])].map((worktree) => ({
        worktreePath: worktree.path,
        branchName: worktree.branchName ?? null,
      }))
  const actionTooltip =
    worktreesToRemove.length > 0
      ? `Remove ${group.label} and associated worktrees`
      : `Remove ${group.label}`
  const runPrune = async () => {
    onCancel()
    await execution.run({
      execute: () =>
        group.worktreePath
          ? onAction('workspace.remove-worktree', {
              projectId: project.id,
              worktreePath: group.worktreePath,
              branchName: group.worktreeBranchName ?? null,
            })
          : onAction('workspace.prune-branch', {
              projectId: project.id,
              branchName: group.label,
              worktrees: worktreesToRemove,
            }),
      getFailure: (result) =>
        getDesktopBranchActionFailure(result, `Could not remove ${group.label}.`),
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
      aria-label={`Remove ${group.label}`}
      disabled={execution.pending}
    >
      {execution.pending ? (
        <ActivitySpinner className="h-3 w-3 text-current" />
      ) : (
        <XSquare size={12} />
      )}
    </button>
  )

  if (confirming) {
    return (
      <SidebarInlineConfirmPopunder
        open={confirming}
        trigger={actionButton}
        confirmAriaLabel={`Confirm remove ${group.label}`}
        confirmIcon={<XSquare size={12} />}
        onCancel={onCancel}
        onConfirm={() => void runPrune()}
      />
    )
  }

  return (
    <SidebarActionTooltip description={actionTooltip} warning={execution.warning}>
      {actionButton}
    </SidebarActionTooltip>
  )
}
