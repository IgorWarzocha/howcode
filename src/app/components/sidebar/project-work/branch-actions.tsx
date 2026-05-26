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
    <Tooltip content={errorMessage ?? `${actionLabel} ${group.label}`} placement="right">
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
  if (!group.worktreePath) return null
  return (
    <Tooltip content="Merge worktree into parent branch" placement="right">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          void onAction('workspace.merge-worktree', {
            projectId: project.id,
            branchName: group.worktreeBranchName ?? group.label,
            worktreePath: group.worktreePath ?? '',
          })
        }}
        aria-label={`Merge ${group.label} worktree into parent branch`}
      >
        <GitMerge size={12} />
      </button>
    </Tooltip>
  )
}

function getCompletedWorktreeTargets(group: BranchThreadGroup) {
  const completedWorktrees =
    group.completedWorktrees ?? group.worktrees.filter((worktree) => worktree.complete)
  return completedWorktrees.map((worktree) => ({
    worktreePath: worktree.path,
    branchName: worktree.branchName ?? group.label,
  }))
}

export function MergeCompletedWorktreesAction({
  group,
  project,
  onAction,
}: {
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
}) {
  const worktrees = getCompletedWorktreeTargets(group)
  if (worktrees.length === 0) return null
  return (
    <Tooltip content="Merge completed worktrees" placement="right">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          void onAction('workspace.merge-completed-worktrees', {
            projectId: project.id,
            worktrees,
          })
        }}
        aria-label={`Merge completed worktrees under ${group.label}`}
      >
        <GitMerge size={12} />
      </button>
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
