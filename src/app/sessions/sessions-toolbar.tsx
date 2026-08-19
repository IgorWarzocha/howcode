import { useRef, useState } from 'react'
import { ConfirmPopover } from '../common/confirm-popover'
import type { SessionBulkAction } from './sessions-model'

export function SessionsToolbar({
  allVisibleSelected,
  currentBranch,
  selectedCount,
  visibleThreadIds,
  onRunBulkAction,
  onSetSelectedThreadIds,
}: {
  allVisibleSelected: boolean
  currentBranch: string | null
  selectedCount: number
  visibleThreadIds: string[]
  onRunBulkAction: (action: SessionBulkAction, threadIds?: string[]) => void
  onSetSelectedThreadIds: (threadIds: string[]) => void
}) {
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<'selected' | 'all' | null>(null)
  const deleteSelectedButtonRef = useRef<HTMLButtonElement>(null)
  const deleteAllButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-[color:var(--muted)]">
      <label className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 pl-2">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[color:var(--accent)]"
          checked={allVisibleSelected}
          onChange={() => onSetSelectedThreadIds(allVisibleSelected ? [] : visibleThreadIds)}
          aria-label="Select visible sessions"
        />
        <span>{selectedCount > 0 ? `${selectedCount} selected` : 'Select sessions'}</span>
      </label>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="rounded px-1.5 py-1 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-45"
          disabled={selectedCount === 0 || !currentBranch}
          onClick={() => onRunBulkAction('assign-current')}
        >
          Assign current branch
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-1 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-45"
          disabled={selectedCount === 0}
          onClick={() => onRunBulkAction('unassign')}
        >
          Unassign
        </button>
        <div className="relative">
          <button
            ref={deleteSelectedButtonRef}
            type="button"
            className="rounded px-1.5 py-1 text-[color:var(--danger)] hover:bg-[color:color-mix(in_srgb,var(--danger-bg)_48%,transparent)] disabled:opacity-45"
            disabled={selectedCount === 0}
            onClick={() =>
              setConfirmDeleteTarget((current) => (current === 'selected' ? null : 'selected'))
            }
          >
            Delete selected
          </button>
          <ConfirmPopover
            open={confirmDeleteTarget === 'selected'}
            anchorRef={deleteSelectedButtonRef}
            confirmLabel="Delete"
            onClose={() => setConfirmDeleteTarget(null)}
            onConfirm={() => {
              setConfirmDeleteTarget(null)
              onRunBulkAction('delete')
            }}
          />
        </div>
        <div className="relative">
          <button
            ref={deleteAllButtonRef}
            type="button"
            className="rounded px-1.5 py-1 text-[color:var(--danger)] hover:bg-[color:color-mix(in_srgb,var(--danger-bg)_48%,transparent)] disabled:opacity-45"
            disabled={visibleThreadIds.length === 0}
            onClick={() => setConfirmDeleteTarget((current) => (current === 'all' ? null : 'all'))}
          >
            Delete all
          </button>
          <ConfirmPopover
            open={confirmDeleteTarget === 'all'}
            anchorRef={deleteAllButtonRef}
            confirmLabel="Delete"
            onClose={() => setConfirmDeleteTarget(null)}
            onConfirm={() => {
              setConfirmDeleteTarget(null)
              onRunBulkAction('delete', visibleThreadIds)
            }}
          />
        </div>
      </div>
    </div>
  )
}
