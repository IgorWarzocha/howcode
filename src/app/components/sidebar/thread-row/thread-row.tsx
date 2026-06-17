import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { Tooltip } from '@howcode/common/tooltip'
import { GitBranch, Pencil, SquareTerminal, Star, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  onRename?: ((title: string) => unknown) | undefined
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
  onRenameStart,
  terminalRunning,
}: Pick<
  ThreadRowProps,
  | 'age'
  | 'assignBranchLabel'
  | 'confirmDelete'
  | 'onDelete'
  | 'onAssignToBranch'
  | 'terminalRunning'
> & { onRenameStart?: (() => void) | undefined }) {
  const metaValue = terminalRunning ? <SquareTerminal size={12} /> : age
  const actionCount = 1 + (onAssignToBranch ? 1 : 0) + (onRenameStart ? 1 : 0)
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
        {onRenameStart ? (
          <Tooltip
            content="Rename session"
            placement="right"
            className="sidebar-thread-action-anchor"
          >
            <button
              type="button"
              className={cn(
                'sidebar-icon-action sidebar-icon-action--sm sidebar-thread-meta-action-button',
                'border-transparent bg-transparent hover:bg-transparent',
              )}
              onClick={onRenameStart}
              aria-label="Rename session"
            >
              <Pencil size={12} />
            </button>
          </Tooltip>
        ) : null}
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
  onRename,
  confirmDelete,
}: ThreadRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipBlurSubmitRef = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(title)
  }, [editing, title])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
  }, [editing])

  const startRename = () => {
    setDraft('')
    setEditing(true)
  }

  const cancelRename = () => {
    skipBlurSubmitRef.current = true
    setDraft(title)
    setEditing(false)
  }

  const submitRename = () => {
    const nextTitle = draft.trim()
    if (!nextTitle || nextTitle === title) {
      cancelRename()
      return
    }
    skipBlurSubmitRef.current = true
    setEditing(false)
    void onRename?.(nextTitle)
  }

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

      {editing ? (
        <form
          className="sidebar-thread-button"
          onSubmit={(event) => {
            event.preventDefault()
            submitRename()
          }}
        >
          <input
            ref={inputRef}
            className="sidebar-thread-title-input"
            placeholder={title}
            value={draft}
            onBlur={() => {
              if (skipBlurSubmitRef.current) {
                skipBlurSubmitRef.current = false
                return
              }
              submitRename()
            }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelRename()
              }
            }}
            aria-label="Session name"
          />
        </form>
      ) : (
        <button
          type="button"
          className="sidebar-thread-button"
          onClick={onOpen}
          aria-current={isSelected ? 'page' : undefined}
        >
          <span className="sidebar-thread-title-text">{title}</span>
        </button>
      )}

      <ThreadMetaSlot
        age={age}
        assignBranchLabel={assignBranchLabel}
        confirmDelete={confirmDelete}
        onDelete={onDelete}
        onAssignToBranch={onAssignToBranch}
        onRenameStart={onRename ? startRename : undefined}
        terminalRunning={terminalRunning}
      />
    </div>
  )
}
