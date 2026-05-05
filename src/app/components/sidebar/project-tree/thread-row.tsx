import { Archive, SquareTerminal, Star } from 'lucide-react'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { ActivitySpinner } from '../../common/activity-spinner'
import { Tooltip } from '../../common/tooltip'

type ThreadRowProps = {
  age: string
  pinned?: boolean
  running?: boolean
  terminalRunning?: boolean
  unread?: boolean
  isSelected: boolean
  title: string
  onArchive: () => void
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
  onArchive,
  terminalRunning,
}: Pick<ThreadRowProps, 'age' | 'onArchive' | 'terminalRunning'>) {
  return (
    <span className="sidebar-thread-meta-slot">
      {terminalRunning ? (
        <span className="sidebar-thread-meta-value">
          <SquareTerminal size={12} />
        </span>
      ) : (
        <span className="sidebar-thread-meta-value" aria-hidden="true">
          {age}
        </span>
      )}
      <Tooltip content="Archive thread" placement="right" className="sidebar-thread-meta-action">
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
  onArchive,
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
        <span className="truncate">{title}</span>
      </button>

      <ThreadMetaSlot age={age} onArchive={onArchive} terminalRunning={terminalRunning} />
    </div>
  )
}
