import { GitBranch, XSquare } from 'lucide-react'
import { ActivitySpinner } from '../../../../../src/app/common/activity-spinner'
import { SidebarActionTooltip } from '../../../../../src/app/components/sidebar/sidebar-action-tooltip'
import { SidebarInlineConfirmPopunder } from '../../../../../src/app/components/sidebar/sidebar-inline-confirm-popunder'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { WorkingDirectory } from '../../../../../src/app/types'
import type { BranchWorkspace } from './branch-group-model'
import { getDesktopBranchActionFailure, useBranchActionExecution } from './useBranchActionExecution'

export function BranchSwitchAction({
  blocked,
  group,
  directory,
  onAction,
}: {
  blocked: boolean
  group: BranchWorkspace
  directory: WorkingDirectory
  onAction: DesktopActionInvoker
}) {
  const execution = useBranchActionExecution()
  const warning = execution.warning ?? (blocked ? 'Worktree is dirty. Commit first.' : null)
  const hasWarning = Boolean(warning)
  const switchBranch = async () => {
    execution.clearWarning()
    await execution.run({
      execute: () =>
        onAction('git.switch-branch', {
          directoryId: directory.id,
          value: group.label,
        }),
      getFailure: (result) => getDesktopBranchActionFailure(result, 'Could not switch branch.'),
    })
  }
  return (
    <SidebarActionTooltip description={`Switch to ${group.label}`} warning={warning}>
      <button
        type="button"
        className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action${hasWarning ? ' sidebar-directory-work-branch-action--danger' : ''}`}
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
  directory,
  confirming,
  onAction,
  onCancel,
  onConfirm,
  onRequestConfirm,
}: {
  group: BranchWorkspace
  directory: WorkingDirectory
  confirming: boolean
  onAction: DesktopActionInvoker
  onCancel: () => void
  onConfirm: () => void
  onRequestConfirm: () => void
}) {
  const execution = useBranchActionExecution()
  const actionTooltip =
    group.kind !== 'worktree' && group.worktrees.length > 0
      ? `Remove ${group.label} and associated worktrees`
      : `Remove ${group.label}`
  const runPrune = async () => {
    onCancel()
    await execution.run({
      execute: () =>
        group.kind === 'worktree'
          ? onAction('worktrees.remove-worktree', {
              rootDirectoryId: directory.id,
              worktreePath: group.worktreePath,
            })
          : onAction('worktrees.prune-branch', {
              rootDirectoryId: directory.id,
              branchName: group.label,
            }),
      getFailure: (result) =>
        getDesktopBranchActionFailure(result, `Could not remove ${group.label}.`),
      onSuccess: onConfirm,
    })
  }

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up${confirming || execution.warning ? ' sidebar-directory-work-branch-action--danger' : ''}`}
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
