import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { Tooltip } from '@howcode/common/tooltip'
import { CheckSquare, GitBranch, GitMerge, Square, Trash2, X, XSquare } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'
import type { BranchThreadGroup } from './project-work-model'

function BranchConfirmPopover({
  confirmAriaLabel,
  confirmIcon,
  onCancel,
  onConfirm,
}: {
  confirmAriaLabel: string
  confirmIcon: ReactNode
  onCancel: () => void
  onConfirm: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onCancel()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && popoverRef.current?.contains(target)) return
      if (
        target instanceof Element &&
        target.closest('.sidebar-project-work-branch-confirm-anchor')
      ) {
        return
      }
      onCancel()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [onCancel])

  return (
    <div
      ref={popoverRef}
      className="sidebar-project-work-branch-actions sidebar-project-work-branch-confirm-popover"
      data-action-count="2"
      data-confirming="true"
    >
      <span className="tooltip-anchor">
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-confirm-button"
          onClick={(event) => {
            event.stopPropagation()
            onCancel()
          }}
          aria-label="Dismiss confirmation"
        >
          <X size={12} />
        </button>
      </span>
      <span className="tooltip-anchor">
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--danger sidebar-project-work-branch-confirm-button"
          onClick={(event) => {
            event.stopPropagation()
            onConfirm()
          }}
          aria-label={confirmAriaLabel}
        >
          {confirmIcon}
        </button>
      </span>
    </div>
  )
}

export function BranchSwitchAction({
  blocked,
  group,
  project,
  onAction,
  onBlocked,
  onSwitchFailed,
}: {
  blocked: boolean
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
  onBlocked: () => void
  onSwitchFailed: () => void
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const tooltipContent =
    errorMessage ?? (blocked ? 'Worktree is dirty. Commit first.' : `Switch to ${group.label}`)
  return (
    <Tooltip content={tooltipContent} placement="right">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          setErrorMessage(null)
          void onAction('workspace.switch-branch', {
            projectId: project.id,
            value: group.label,
          }).then((result) => {
            const error = result?.result?.error
            if (!error) {
              onSwitchFailed()
              return
            }
            setErrorMessage(error)
            if (typeof error === 'string' && error.includes('Worktree is dirty')) {
              onBlocked()
              return
            }
            onSwitchFailed()
          })
        }}
        aria-label={`Switch to ${group.label}`}
      >
        <GitBranch size={12} />
      </button>
    </Tooltip>
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
  const actionLabel = 'Remove'
  const worktreesToRemove = group.worktreePath
    ? []
    : [...group.worktrees, ...(group.completedWorktrees ?? [])].map((worktree) => ({
        worktreePath: worktree.path,
        branchName: worktree.branchName ?? null,
      }))
  const actionTooltip = errorMessage
    ? errorMessage
    : worktreesToRemove.length > 0
      ? `Remove ${group.label} and associated worktrees`
      : `${actionLabel} ${group.label}`
  const runPrune = async () => {
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
  }

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        setErrorMessage(null)
        onRequestConfirm()
      }}
      aria-label={`${actionLabel} ${group.label}`}
    >
      <XSquare size={12} />
    </button>
  )

  if (confirming) {
    return (
      <span className="tooltip-anchor sidebar-project-work-branch-confirm-anchor">
        {actionButton}
        <BranchConfirmPopover
          confirmAriaLabel={`Confirm ${actionLabel.toLowerCase()} ${group.label}`}
          confirmIcon={<XSquare size={12} />}
          onCancel={onCancel}
          onConfirm={() => void runPrune()}
        />
      </span>
    )
  }

  return (
    <Tooltip content={actionTooltip} placement="right">
      {actionButton}
    </Tooltip>
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
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          void onAction(action, {
            projectId: project.id,
            worktreePath: group.worktreePath ?? '',
          })
        }}
        aria-label={`${label}: ${group.label}`}
      >
        {complete ? <Square size={12} /> : <CheckSquare size={12} />}
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
    : (warningMessage ?? 'Merge worktree into parent branch')

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-merge-action${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
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
      <span className="tooltip-anchor sidebar-project-work-branch-confirm-anchor">
        {actionButton}
        <BranchConfirmPopover
          confirmAriaLabel={`Confirm merge ${group.label} worktree into parent branch`}
          confirmIcon={<GitMerge size={12} />}
          onCancel={() => setConfirming(false)}
          onConfirm={mergeWorktree}
        />
      </span>
    )
  }

  return (
    <Tooltip content={tooltipContent} placement="right">
      {actionButton}
    </Tooltip>
  )
}

function getCompletedWorktreeTargets(
  group: BranchThreadGroup,
  options: { requireBranch?: boolean } = {},
) {
  const completedWorktrees =
    group.completedWorktrees ?? group.worktrees.filter((worktree) => worktree.complete)
  return completedWorktrees
    .filter((worktree) => !options.requireBranch || Boolean(worktree.branchName))
    .map((worktree) => ({
      worktreePath: worktree.path,
      branchName: worktree.branchName ?? null,
    }))
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

  const tooltipContent = pending
    ? 'Merging completed worktrees…'
    : (warningMessage ?? 'Merge completed worktrees')

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-merge-action${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
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
      <span className="tooltip-anchor sidebar-project-work-branch-confirm-anchor">
        {actionButton}
        <BranchConfirmPopover
          confirmAriaLabel={`Merge completed worktrees under ${group.label}`}
          confirmIcon={<GitMerge size={12} />}
          onCancel={onCancel}
          onConfirm={mergeCompleted}
        />
      </span>
    )
  }

  return (
    <Tooltip content={tooltipContent} placement="right">
      {actionButton}
    </Tooltip>
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
  const worktrees = getCompletedWorktreeTargets(group)
  if (worktrees.length === 0) return null

  const removeCompleted = async () => {
    const result = await onAction('workspace.remove-completed-worktrees', {
      projectId: project.id,
      worktrees,
    })
    if (!result?.result?.error) onConfirm()
  }

  const actionButton = (
    <button
      type="button"
      className={`sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action${confirming ? ' sidebar-project-work-branch-action--danger' : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        onRequestConfirm()
      }}
      aria-label={`Remove completed worktrees under ${group.label}`}
    >
      <Trash2 size={12} />
    </button>
  )

  if (confirming) {
    return (
      <span className="tooltip-anchor sidebar-project-work-branch-confirm-anchor">
        {actionButton}
        <BranchConfirmPopover
          confirmAriaLabel={`Remove completed worktrees under ${group.label}`}
          confirmIcon={<Trash2 size={12} />}
          onCancel={onCancel}
          onConfirm={() => void removeCompleted()}
        />
      </span>
    )
  }

  return (
    <Tooltip content="Remove completed worktrees" placement="right">
      {actionButton}
    </Tooltip>
  )
}
