import { CheckSquare, GitMerge, Square } from 'lucide-react'
import { useState } from 'react'
import { ActivitySpinner } from '../../../../../src/app/common/activity-spinner'
import { SidebarActionTooltip } from '../../../../../src/app/components/sidebar/sidebar-action-tooltip'
import { SidebarInlineConfirmPopunder } from '../../../../../src/app/components/sidebar/sidebar-inline-confirm-popunder'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { WorkingDirectory } from '../../../../../src/app/types'
import type { BranchWorkspace } from './branch-group-model'
import { getDesktopBranchActionFailure, useBranchActionExecution } from './useBranchActionExecution'

export function WorktreeCompletionAction({
  group,
  directory,
  onAction,
}: {
  group: BranchWorkspace
  directory: WorkingDirectory
  onAction: DesktopActionInvoker
}) {
  const execution = useBranchActionExecution()
  if (group.kind !== 'worktree') return null
  const complete = group.worktreeComplete
  const action = complete ? 'coding.mark-worktree-incomplete' : 'coding.mark-worktree-complete'
  const label = complete ? 'Mark worktree as incomplete' : 'Mark worktree as complete'
  const runCompletionAction = async () => {
    execution.clearWarning()
    await execution.run({
      execute: () =>
        onAction(action, {
          rootDirectoryId: directory.id,
          worktreePath: group.worktreePath,
        }),
      getFailure: (result) =>
        getDesktopBranchActionFailure(result, 'Could not update worktree completion.'),
    })
  }
  return (
    <SidebarActionTooltip description={label} warning={execution.warning}>
      <button
        type="button"
        className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up${execution.warning ? ' sidebar-directory-work-branch-action--danger' : ''}`}
        data-warning={execution.warning ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation()
          void runCompletionAction()
        }}
        aria-label={`${label}: ${group.label}`}
        disabled={execution.pending}
      >
        {execution.pending ? (
          <ActivitySpinner className="h-3 w-3 text-current" />
        ) : complete ? (
          <Square size={12} />
        ) : (
          <CheckSquare size={12} />
        )}
      </button>
    </SidebarActionTooltip>
  )
}

export function WorktreeMergeAction({
  group,
  directory,
  onAction,
}: {
  group: BranchWorkspace
  directory: WorkingDirectory
  onAction: DesktopActionInvoker
}) {
  const execution = useBranchActionExecution()
  const [confirming, setConfirming] = useState(false)
  if (group.kind !== 'worktree') return null

  const mergeWorktree = async () => {
    setConfirming(false)
    execution.clearWarning()
    await execution.run({
      execute: () =>
        onAction('coding.merge-worktree', {
          rootDirectoryId: directory.id,
          worktreePath: group.worktreePath,
        }),
      getFailure: (result) => getDesktopBranchActionFailure(result, 'Could not merge worktree.'),
    })
  }

  const tooltipContent = execution.pending
    ? 'Merging worktree into current branch…'
    : 'Merge worktree into current branch'
  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-merge-action${confirming ? ' sidebar-directory-work-branch-action--danger' : ''}`}
      data-warning={execution.warning ? 'true' : 'false'}
      disabled={execution.pending}
      onClick={(event) => {
        event.stopPropagation()
        execution.clearWarning()
        setConfirming(true)
      }}
      aria-label={`Merge ${group.label} worktree into current branch`}
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
        confirmAriaLabel={`Confirm merge ${group.label} worktree into current branch`}
        confirmIcon={<GitMerge size={12} />}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void mergeWorktree()}
      />
    )
  }

  return (
    <SidebarActionTooltip description={tooltipContent} warning={execution.warning}>
      {actionButton}
    </SidebarActionTooltip>
  )
}
