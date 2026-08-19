import { GitBranch, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { ConfirmPopover } from '../common/confirm-popover'
import { Tooltip } from '../common/tooltip'
import type { DesktopActionInvoker } from '../desktop/types'
import { appToneTextClass, viewCloseButtonClass } from '../ui/classes'
import { getSessionAssignmentLabel, type PastSessionThread } from './sessions-model'

export function SessionRow({
  currentBranch,
  selected,
  thread,
  onAction,
  onDelete,
  onOpenThread,
  onToggleSelected,
}: {
  currentBranch: string | null
  selected: boolean
  thread: PastSessionThread
  onAction: DesktopActionInvoker
  onDelete: () => void
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleSelected: () => void
}) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const canAssignToCurrentBranch = Boolean(currentBranch && !thread.branchName?.trim())
  const assignLabel = currentBranch ? `Assign to ${currentBranch}` : null

  return (
    <div className="grid min-h-9 min-w-0 grid-cols-[1rem_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 rounded-md px-2 text-sm text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[color:var(--accent)]"
        checked={selected}
        onChange={onToggleSelected}
        aria-label={`Select ${thread.title}`}
      />
      <button
        type="button"
        className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-center text-left"
        onClick={() => {
          if (!thread.sessionPath) return
          onOpenThread(thread.projectId, thread.id, thread.sessionPath)
        }}
      >
        <span className={`truncate ${appToneTextClass}`}>{thread.title}</span>
      </button>
      <span className="inline-flex min-w-0 max-w-44 items-center gap-1 truncate text-xs text-[color:var(--muted-2)]">
        <GitBranch size={12} className="shrink-0" />
        <span className="truncate">{getSessionAssignmentLabel(thread)}</span>
      </span>
      {canAssignToCurrentBranch && assignLabel ? (
        <Tooltip content={assignLabel}>
          <button
            type="button"
            className={viewCloseButtonClass}
            aria-label={`${assignLabel} for ${thread.title}`}
            onClick={() => {
              void onAction('thread.assign-branch', {
                projectId: thread.projectId,
                threadId: thread.id,
                branchName: currentBranch,
              })
            }}
          >
            <GitBranch size={13} />
          </button>
        </Tooltip>
      ) : null}
      <span className="shrink-0 text-xs text-[color:var(--muted-2)]">{thread.age}</span>
      <div className="relative">
        <Tooltip content="Delete session">
          <button
            ref={deleteButtonRef}
            type="button"
            className={viewCloseButtonClass}
            aria-label={`Delete ${thread.title}`}
            onClick={() => setConfirmDeleteOpen((current) => !current)}
          >
            <Trash2 size={13} />
          </button>
        </Tooltip>
        <ConfirmPopover
          open={confirmDeleteOpen}
          anchorRef={deleteButtonRef}
          confirmLabel="Delete"
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={() => {
            setConfirmDeleteOpen(false)
            onDelete()
          }}
        />
      </div>
    </div>
  )
}
