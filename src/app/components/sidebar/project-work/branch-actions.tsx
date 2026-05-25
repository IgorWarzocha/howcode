import { Tooltip } from '@howcode/common/tooltip'
import { GitBranch, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project } from '../../../types'
import type { BranchThreadGroup } from './project-work-model'

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
  if (confirming) {
    return (
      <>
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
          onClick={(event) => {
            event.stopPropagation()
            onCancel()
          }}
          aria-label="Cancel prune"
        >
          <X size={12} />
        </button>
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--danger"
          onClick={(event) => {
            event.stopPropagation()
            onConfirm()
            void onAction('workspace.prune-branch', {
              projectId: project.id,
              branchName: group.label,
            })
          }}
          aria-label={`Confirm prune ${group.label}`}
        >
          <Trash2 size={12} />
        </button>
      </>
    )
  }

  return (
    <Tooltip content={`Prune ${group.label}`} placement="right">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          onRequestConfirm()
        }}
        aria-label={`Prune ${group.label}`}
      >
        <Trash2 size={12} />
      </button>
    </Tooltip>
  )
}
