import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { Tooltip } from '@howcode/common/tooltip'
import { GitBranch, SquareTerminal, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../../utils/cn'
import { SidebarInlineConfirmPopunder } from '../sidebar-inline-confirm-popunder'

type ThreadRowProps = {
  age: string
  pinned?: boolean
  running?: boolean
  terminalRunning?: boolean
  unread?: boolean
  isSelected: boolean
  title: string
  assignBranchLabel?: string | undefined
  onDelete: () => void
  onAssignToBranch?: (() => void) | undefined
  onOpen: () => void
  onPin: () => void
  confirmDelete?: boolean | undefined
}

function ThreadLeadingIcon({
  isSelected,
  onPin,
  pinned,
  running,
  unread,
}: Pick<ThreadRowProps, 'pinned' | 'running' | 'unread' | 'onPin'> & { isSelected: boolean }) {
  if (running) {
    return (
      <span className="sidebar-thread-leading-icon">
        <ActivitySpinner />
      </span>
    )
  }

  if (unread) return <span className="sidebar-thread-pin-indicator" aria-hidden="true" />

  return (
    <Tooltip content={pinned ? 'Unmark favourite' : 'Mark favourite'} placement="right">
      <button
        type="button"
        className="sidebar-thread-pin"
        onClick={onPin}
        data-pinned={pinned ? 'true' : 'false'}
        data-selected={isSelected ? 'true' : 'false'}
        aria-label={pinned ? 'Unmark favourite' : 'Mark favourite'}
        aria-pressed={pinned}
      >
        <Star size={12} className={cn('absolute inset-0 m-auto', pinned && 'fill-current')} />
      </button>
    </Tooltip>
  )
}

function ThreadMetaSlot({
  age,
  assignBranchLabel,
  confirmDelete,
  onDelete,
  onAssignToBranch,
  terminalRunning,
}: Pick<
  ThreadRowProps,
  | 'age'
  | 'assignBranchLabel'
  | 'confirmDelete'
  | 'onDelete'
  | 'onAssignToBranch'
  | 'terminalRunning'
>) {
  const metaValue = terminalRunning ? <SquareTerminal size={12} /> : age
  const actionCount = onAssignToBranch ? 2 : 1
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const handleDeleteClick = () => {
    if (!confirmDelete) {
      onDelete()
      return
    }
    setConfirmDeleteOpen((current) => !current)
  }

  return (
    <span className="sidebar-thread-meta-slot">
      <span className="sidebar-thread-meta-value" aria-hidden="true">
        {metaValue}
      </span>
      <span className="sidebar-thread-meta-actions" data-action-count={actionCount}>
        {onAssignToBranch ? (
          <Tooltip
            content={assignBranchLabel ?? 'Assign to branch'}
            placement="right"
            className="sidebar-thread-action-anchor"
          >
            <button
              type="button"
              className={cn(
                'sidebar-icon-action sidebar-icon-action--sm sidebar-thread-meta-action-button',
                'border-transparent bg-transparent hover:bg-transparent',
              )}
              onClick={onAssignToBranch}
              aria-label={assignBranchLabel ?? 'Assign to branch'}
            >
              <GitBranch size={12} />
            </button>
          </Tooltip>
        ) : null}
        <Tooltip
          content="Delete session"
          placement="right"
          className="sidebar-thread-action-anchor"
        >
          <SidebarInlineConfirmPopunder
            open={confirmDeleteOpen}
            trigger={
              <button
                type="button"
                className={cn(
                  'sidebar-icon-action sidebar-icon-action--sm sidebar-thread-meta-action-button',
                  confirmDeleteOpen && 'sidebar-inline-action-button--danger',
                  'border-transparent bg-transparent hover:bg-transparent',
                )}
                onClick={handleDeleteClick}
                aria-label="Delete session"
              >
                <Trash2 size={12} />
              </button>
            }
            confirmAriaLabel="Delete session"
            confirmIcon={<Trash2 size={12} />}
            onCancel={() => setConfirmDeleteOpen(false)}
            onConfirm={() => {
              setConfirmDeleteOpen(false)
              onDelete()
            }}
          />
        </Tooltip>
      </span>
    </span>
  )
}

export function ThreadRow({
  age,
  pinned = false,
  running = false,
  terminalRunning = false,
  unread = false,
  isSelected,
  title,
  assignBranchLabel,
  onDelete,
  onAssignToBranch,
  onOpen,
  onPin,
  confirmDelete,
}: ThreadRowProps) {
  return (
    <div
      className="sidebar-row-surface sidebar-thread-row"
      data-selected={isSelected ? 'true' : 'false'}
    >
      <ThreadLeadingIcon
        isSelected={isSelected}
        onPin={onPin}
        pinned={pinned}
        running={running}
        unread={unread}
      />

      <button
        type="button"
        className="sidebar-thread-button"
        onClick={onOpen}
        aria-current={isSelected ? 'page' : undefined}
      >
        <span className="sidebar-thread-title-text">{title}</span>
      </button>

      <ThreadMetaSlot
        age={age}
        assignBranchLabel={assignBranchLabel}
        confirmDelete={confirmDelete}
        onDelete={onDelete}
        onAssignToBranch={onAssignToBranch}
        terminalRunning={terminalRunning}
      />
    </div>
  )
}
