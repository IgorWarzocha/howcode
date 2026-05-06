import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { ChevronDown, ChevronRight, Folder, MoreHorizontal, Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { Tooltip } from '../../common/tooltip'

type ChatGroupRowProps = {
  actionMenuId: string
  actionMenuOpen: boolean
  dragHandleProps?: {
    attributes: DraggableAttributes
    listeners: DraggableSyntheticListeners | undefined
  }
  isActive: boolean
  isDragging: boolean
  isExpanded: boolean
  name: string
  renameDraft: string
  isEditing: boolean
  threadGroupId: string
  onCancelEdit: () => void
  onChangeRenameDraft: (value: string) => void
  onCreateSession: () => void
  onEdit: () => void
  onSelect: () => void
  onSubmitEdit: () => void
  onToggleActions: () => void
  onToggleExpanded: () => void
}

function ChatGroupNameEditor({
  inputRef,
  name,
  onCancelEdit,
  onChangeRenameDraft,
  onSubmitEdit,
  renameDraft,
}: Pick<
  ChatGroupRowProps,
  'name' | 'onCancelEdit' | 'onChangeRenameDraft' | 'onSubmitEdit' | 'renameDraft'
> & {
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="sidebar-project-edit">
      <input
        ref={inputRef}
        value={renameDraft}
        onChange={(event) => onChangeRenameDraft(event.target.value)}
        onBlur={onCancelEdit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSubmitEdit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancelEdit()
          }
        }}
        className="sidebar-project-input"
        aria-label={`Rename ${name}`}
      />
    </div>
  )
}

function ChatGroupNameButton({
  dragHandleProps,
  handleRowClick,
  handleRowDoubleClick,
  isActive,
  name,
}: Pick<ChatGroupRowProps, 'isActive' | 'name'> & {
  dragHandleProps: ChatGroupRowProps['dragHandleProps']

  handleRowClick: () => void
  handleRowDoubleClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'sidebar-project-button',
        dragHandleProps ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      )}
      {...dragHandleProps?.attributes}
      {...dragHandleProps?.listeners}
      onClick={handleRowClick}
      onDoubleClick={handleRowDoubleClick}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="sidebar-project-title">{name}</span>
    </button>
  )
}

function ChatGroupActions({
  actionMenuId,
  actionMenuOpen,
  isDragging,
  isEditing,
  name,
  onCreateSession,
  onToggleActions,
}: Pick<
  ChatGroupRowProps,
  | 'actionMenuId'
  | 'actionMenuOpen'
  | 'isDragging'
  | 'isEditing'
  | 'name'
  | 'onCreateSession'
  | 'onToggleActions'
>) {
  return (
    <div
      className="sidebar-project-actions"
      data-open={actionMenuOpen ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
      data-editing={isEditing ? 'true' : 'false'}
      data-visible="true"
    >
      <Tooltip content="New chat" placement="right">
        <button
          type="button"
          className={compactIconButtonClass}
          onClick={onCreateSession}
          aria-label={`Start a new chat in ${name}`}
        >
          <Plus size={14} />
        </button>
      </Tooltip>

      <Tooltip content="Group actions" placement="right">
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            actionMenuOpen && 'bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]',
          )}
          onClick={onToggleActions}
          aria-label="Group actions"
          aria-haspopup="menu"
          aria-expanded={actionMenuOpen}
          aria-controls={actionMenuId}
        >
          <MoreHorizontal size={14} />
        </button>
      </Tooltip>
    </div>
  )
}

export function ChatGroupRow({
  actionMenuId,
  actionMenuOpen,
  dragHandleProps,
  isActive,
  isDragging,
  isExpanded,
  name,
  renameDraft,
  isEditing,
  threadGroupId,
  onCancelEdit,
  onChangeRenameDraft,
  onCreateSession,
  onEdit,
  onSelect,
  onSubmitEdit,
  onToggleActions,
  onToggleExpanded,
}: ChatGroupRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const clickTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) window.clearTimeout(clickTimeoutRef.current)
    }
  }, [])

  const handleRowClick = () => {
    if (clickTimeoutRef.current !== null) window.clearTimeout(clickTimeoutRef.current)
    clickTimeoutRef.current = window.setTimeout(() => {
      onSelect()
      onToggleExpanded()
      clickTimeoutRef.current = null
    }, 180)
  }

  const handleRowDoubleClick = () => {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
    onEdit()
  }

  return (
    <div
      className="sidebar-row-surface sidebar-project-row"
      data-highlighted={isActive || actionMenuOpen ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
    >
      <Tooltip content={isExpanded ? 'Collapse group' : 'Expand group'} placement="right">
        <button
          type="button"
          className="sidebar-project-toggle"
          onClick={onToggleExpanded}
          data-can-toggle="true"
          aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
          aria-expanded={isExpanded}
          aria-controls={threadGroupId}
        >
          <Folder size={12} className="sidebar-project-icon sidebar-project-origin-icon" />
          {isExpanded ? (
            <ChevronDown size={12} className="sidebar-project-icon sidebar-project-chevron-icon" />
          ) : (
            <ChevronRight size={12} className="sidebar-project-icon sidebar-project-chevron-icon" />
          )}
        </button>
      </Tooltip>

      {isEditing ? (
        <ChatGroupNameEditor
          inputRef={inputRef}
          name={name}
          onCancelEdit={onCancelEdit}
          onChangeRenameDraft={onChangeRenameDraft}
          onSubmitEdit={onSubmitEdit}
          renameDraft={renameDraft}
        />
      ) : (
        <ChatGroupNameButton
          dragHandleProps={dragHandleProps}
          handleRowClick={handleRowClick}
          handleRowDoubleClick={handleRowDoubleClick}
          isActive={isActive}
          name={name}
        />
      )}

      <ChatGroupActions
        actionMenuId={actionMenuId}
        actionMenuOpen={actionMenuOpen}
        isDragging={isDragging}
        isEditing={isEditing}
        name={name}
        onCreateSession={onCreateSession}
        onToggleActions={onToggleActions}
      />
    </div>
  )
}
