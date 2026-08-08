import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { Tooltip } from '@howcode/common/tooltip'
import { CheckSquare, GitBranch, GitMerge, Square, Trash2, XSquare } from 'lucide-react'
import { useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'
import { SidebarActionTooltip } from '../sidebar-action-tooltip'
import { SidebarInlineConfirmPopunder } from '../sidebar-inline-confirm-popunder'
import type { BranchThreadGroup } from './project-work-model'

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const warning = errorMessage ?? (blocked ? 'Worktree is dirty. Commit first.' : null)
  const hasWarning = Boolean(warning)
  const switchBranch = async () => {
    setErrorMessage(null)
    setPending(true)
    try {
      const result = await onAction('workspace.switch-branch', {
        projectId: project.id,
        value: group.label,
      })
      const error = result?.result?.error
      if (!error) return
      setErrorMessage(error)
    } finally {
      setPending(false)
    }
  }
  return (
    <SidebarActionTooltip description={`Switch to ${group.label}`} warning={warning}>
      <button
        type="button"
        className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action${hasWarning ? ' sidebar-project-work-branch-action--danger' : ''}`}
        data-warning={hasWarning ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation()
          void switchBranch()
        }}
        aria-label={`Switch to ${group.label}`}
        disabled={pending}
      >
        {pending ? <ActivitySpinner className="h-3 w-3 text-current" /> : <GitBranch size={12} />}
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const actionLabel = 'Remove'
  const worktreesToRemove = group.worktreePath
    ? []
    : [...group.worktrees, ...(group.completedWorktrees ?? [])].map((worktree) => ({
        worktreePath: worktree.path,
        branchName: worktree.branchName ?? null,
      }))
  const actionTooltip =
    worktreesToRemove.length > 0
      ? `Remove ${group.label} and associated worktrees`
      : `${actionLabel} ${group.label}`
  const runPrune = async () => {
    setPending(true)
    try {
      const result = group.worktreePath
        ? await onAction('workspace.remove-worktree', {
            projectId: project.id,
            worktreePath: group.worktreePath,
            branchName: group.worktreeBranchName ?? null,
          })
        : await onAction('workspace.prune-branch', {
            projectId: project.id,
            branchName: group.label,
            worktrees: worktreesToRemove,
          })
      const error = result?.result?.error
      if (error) {
        setErrorMessage(error)
        return
      }
      onConfirm()
    } finally {
      setPending(false)
    }
  }

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        setErrorMessage(null)
        onRequestConfirm()
      }}
      aria-label={`${actionLabel} ${group.label}`}
      disabled={pending}
    >
      {pending ? <ActivitySpinner className="h-3 w-3 text-current" /> : <XSquare size={12} />}
    </button>
  )

  if (confirming) {
    return (
      <SidebarInlineConfirmPopunder
        open={confirming}
        trigger={actionButton}
        confirmAriaLabel={`Confirm ${actionLabel.toLowerCase()} ${group.label}`}
        confirmIcon={<XSquare size={12} />}
        onCancel={onCancel}
        onConfirm={() => void runPrune()}
      />
    )
  }

  return (
    <SidebarActionTooltip description={actionTooltip} warning={errorMessage}>
      {actionButton}
    </SidebarActionTooltip>
  )
}

export function WorktreeCompletionAction({
  group,
  project,
  onAction,
}: {
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
}) {
  const [pending, setPending] = useState(false)
  if (!group.worktreePath) return null
  const complete = Boolean(group.worktreeComplete)
  const action = complete
    ? 'workspace.mark-worktree-incomplete'
    : 'workspace.mark-worktree-complete'
  const label = complete ? 'Mark worktree as incomplete' : 'Mark worktree as complete'
  return (
    <Tooltip content={label} placement="right">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up"
        onClick={(event) => {
          event.stopPropagation()
          setPending(true)
          void onAction(action, {
            projectId: project.id,
            worktreePath: group.worktreePath ?? '',
          }).finally(() => setPending(false))
        }}
        aria-label={`${label}: ${group.label}`}
        disabled={pending}
      >
        {pending ? (
          <ActivitySpinner className="h-3 w-3 text-current" />
        ) : complete ? (
          <Square size={12} />
        ) : (
          <CheckSquare size={12} />
        )}
      </button>
    </Tooltip>
  )
}

export function WorktreeMergeAction({
  group,
  project,
  onAction,
}: {
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
}) {
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  if (!group.worktreePath) return null

  const mergeWorktree = () => {
    setPending(true)
    setConfirming(false)
    setWarningMessage(null)
    void onAction('workspace.merge-worktree', {
      projectId: project.id,
      branchName: group.worktreeBranchName ?? group.label,
      worktreePath: group.worktreePath ?? '',
    })
      .then((result) => {
        const error = result?.result?.error
        if (typeof error === 'string' && error.trim().length > 0) {
          setWarningMessage(
            'Merge needs attention in parent branch. Start a session on the parent branch to resolve it.',
          )
        }
      })
      .finally(() => setPending(false))
  }

  const tooltipContent = pending
    ? 'Merging worktree into parent branch…'
    : 'Merge worktree into parent branch'

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-merge-action${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
      data-warning={warningMessage ? 'true' : 'false'}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation()
        setWarningMessage(null)
        setConfirming(true)
      }}
      aria-label={`Merge ${group.label} worktree into parent branch`}
    >
      {pending ? <ActivitySpinner className="h-3 w-3 text-current" /> : <GitMerge size={12} />}
    </button>
  )

  if (confirming) {
    return (
      <SidebarInlineConfirmPopunder
        open={confirming}
        trigger={actionButton}
        confirmAriaLabel={`Confirm merge ${group.label} worktree into parent branch`}
        confirmIcon={<GitMerge size={12} />}
        onCancel={() => setConfirming(false)}
        onConfirm={mergeWorktree}
      />
    )
  }

  return (
    <SidebarActionTooltip description={tooltipContent} warning={warningMessage}>
      {actionButton}
    </SidebarActionTooltip>
  )
}

function getCompletedWorktreeTargets(
  group: BranchThreadGroup,
  options: { requireBranch?: boolean } = {},
) {
  const completedWorktrees =
    group.completedWorktrees ?? group.worktrees.filter((worktree) => worktree.complete)
  return completedWorktrees.flatMap((worktree) =>
    !options.requireBranch || worktree.branchName
      ? [{ worktreePath: worktree.path, branchName: worktree.branchName ?? null }]
      : [],
  )
}

function getCompletedWorktreeFailureLabel(
  group: BranchThreadGroup,
  failedWorktreePath: string | undefined,
  failedWorktreeBranchName: string | null | undefined,
) {
  const completedWorktrees =
    group.completedWorktrees ?? group.worktrees.filter((worktree) => worktree.complete)
  const failedWorktree = completedWorktrees.find((worktree) => worktree.path === failedWorktreePath)
  return failedWorktree?.label ?? failedWorktreeBranchName ?? failedWorktreePath ?? 'a worktree'
}

export function MergeCompletedWorktreesAction({
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
  const [pending, setPending] = useState(false)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const worktrees = getCompletedWorktreeTargets(group, { requireBranch: true })
  if (worktrees.length === 0) return null

  const mergeCompleted = () => {
    setPending(true)
    setWarningMessage(null)
    onCancel()
    void onAction('workspace.merge-completed-worktrees', {
      projectId: project.id,
      worktrees,
    })
      .then((result) => {
        const error = result?.result?.error
        if (typeof error === 'string' && error.trim().length > 0) {
          const failureLabel = getCompletedWorktreeFailureLabel(
            group,
            result?.result?.failedWorktreePath,
            result?.result?.failedWorktreeBranchName,
          )
          setWarningMessage(
            `${failureLabel} did not merge. Start a session on the parent branch to resolve it.`,
          )
          return
        }
        onConfirm()
      })
      .finally(() => setPending(false))
  }

  const tooltipContent = pending ? 'Merging completed worktrees…' : 'Merge completed worktrees'

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-merge-action${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
      data-warning={warningMessage ? 'true' : 'false'}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation()
        setWarningMessage(null)
        onRequestConfirm()
      }}
      aria-label={`Merge completed worktrees under ${group.label}`}
    >
      {pending ? <ActivitySpinner className="h-3 w-3 text-current" /> : <GitMerge size={12} />}
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
        onConfirm={mergeCompleted}
      />
    )
  }

  return (
    <SidebarActionTooltip description={tooltipContent} warning={warningMessage}>
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
}: {
  group: BranchThreadGroup
  project: Project
  confirming: boolean
  onAction: DesktopActionInvoker
  onCancel: () => void
  onConfirm: () => void
  onRequestConfirm: () => void
}) {
  const [pending, setPending] = useState(false)
  const worktrees = getCompletedWorktreeTargets(group)
  if (worktrees.length === 0) return null

  const removeCompleted = async () => {
    setPending(true)
    try {
      const result = await onAction('workspace.remove-completed-worktrees', {
        projectId: project.id,
        worktrees,
      })
      if (!result?.result?.error) onConfirm()
    } finally {
      setPending(false)
    }
  }

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        onRequestConfirm()
      }}
      aria-label={`Remove completed worktrees under ${group.label}`}
      disabled={pending}
    >
      {pending ? <ActivitySpinner className="h-3 w-3 text-current" /> : <Trash2 size={12} />}
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
    <Tooltip content="Remove completed worktrees" placement="right">
      {actionButton}
    </Tooltip>
  )
}
