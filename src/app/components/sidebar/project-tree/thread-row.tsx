import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { Tooltip } from '@howcode/common/tooltip'
import { Archive, GitBranch, SquareTerminal, Star } from 'lucide-react'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

type ThreadRowProps = {
  age: string
  pinned?: boolean
  running?: boolean
  terminalRunning?: boolean
  unread?: boolean
  isSelected: boolean
  title: string
  branchName?: string | undefined
  branchAssignedToCurrent?: boolean | undefined
  assignBranchLabel?: string | undefined
  onArchive: () => void
  onAssignToBranch?: (() => void) | undefined
  onOpen: () => void
  onPin: () => void
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
  branchAssignedToCurrent,
  branchName,
  assignBranchLabel,
  onArchive,
  onAssignToBranch,
  terminalRunning,
}: Pick<
  ThreadRowProps,
  | 'age'
  | 'assignBranchLabel'
  | 'branchAssignedToCurrent'
  | 'branchName'
  | 'onArchive'
  | 'onAssignToBranch'
  | 'terminalRunning'
>) {
  const metaValue = branchName ? (
    <span
      className="sidebar-thread-branch-status"
      data-current={branchAssignedToCurrent ? 'true' : 'false'}
      title={`Assigned to ${branchName}`}
    >
      <GitBranch size={12} />
    </span>
  ) : terminalRunning ? (
    <SquareTerminal size={12} />
  ) : (
    age
  )

  return (
    <span className="sidebar-thread-meta-slot">
      <span className="sidebar-thread-meta-value" aria-hidden={branchName ? undefined : 'true'}>
        {metaValue}
      </span>
      <span className="sidebar-thread-meta-actions">
        {onAssignToBranch ? (
          <Tooltip
            content={assignBranchLabel ?? 'Assign to branch'}
            placement="right"
            className="sidebar-thread-action-anchor"
          >
            <button
              type="button"
              className={cn(
                compactIconButtonClass,
                'h-full w-full border-transparent bg-transparent hover:bg-transparent',
              )}
              data-active={branchAssignedToCurrent ? 'true' : 'false'}
              onClick={onAssignToBranch}
              aria-label={assignBranchLabel ?? 'Assign to branch'}
            >
              <GitBranch size={12} />
            </button>
          </Tooltip>
        ) : null}
        <Tooltip
          content="Archive thread"
          placement="right"
          className="sidebar-thread-action-anchor"
        >
          <button
            type="button"
            className={cn(
              compactIconButtonClass,
              'h-full w-full border-transparent bg-transparent hover:bg-transparent',
            )}
            onClick={onArchive}
            aria-label="Archive thread"
          >
            <Archive size={12} />
          </button>
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
  branchName,
  branchAssignedToCurrent,
  assignBranchLabel,
  onArchive,
  onAssignToBranch,
  onOpen,
  onPin,
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
        branchAssignedToCurrent={branchAssignedToCurrent}
        branchName={branchName}
        onArchive={onArchive}
        onAssignToBranch={onAssignToBranch}
        terminalRunning={terminalRunning}
      />
    </div>
  )
}
