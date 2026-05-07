import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { ChevronDown, ChevronRight, Folder, Github, MoreHorizontal, Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { Tooltip } from '../../common/tooltip'

type ProjectRowProps = {
  actionMenuId: string
  actionMenuOpen: boolean
  dragHandleProps:
    | {
        attributes: DraggableAttributes
        listeners: DraggableSyntheticListeners | undefined
      }
    | undefined
  canEdit: boolean
  canToggleExpanded: boolean
  isActive: boolean
  isDragging: boolean
  isExpanded: boolean
  hasRepoOrigin: boolean
  name: string
  renameDraft: string
  isEditing: boolean
  showActions: boolean
  threadGroupId: string
  onCancelEdit: () => void
  onChangeRenameDraft: (value: string) => void
  onEdit: () => void
  onCreateSession: () => void
  onSelect: () => void
  onSubmitEdit: () => void
  onToggleActions: () => void
  onToggleExpanded: () => void
}

function clearClickTimeout(clickTimeoutRef: React.MutableRefObject<number | null>) {
  if (clickTimeoutRef.current === null) return
  window.clearTimeout(clickTimeoutRef.current)
  clickTimeoutRef.current = null
}

function ProjectRowName({
  canEdit,
  dragHandleProps,
  handleRowClick,
  handleRowDoubleClick,
  inputRef,
  isActive,
  isEditing,
  name,
  onCancelEdit,
  onChangeRenameDraft,
  onSubmitEdit,
  renameDraft,
}: Pick<
  ProjectRowProps,
  | 'canEdit'
  | 'isActive'
  | 'isEditing'
  | 'name'
  | 'onCancelEdit'
  | 'onChangeRenameDraft'
  | 'onSubmitEdit'
  | 'renameDraft'
> & {
  dragHandleProps: ProjectRowProps['dragHandleProps']
  handleRowClick: () => void
  handleRowDoubleClick: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  if (isEditing) {
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
              return
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
      onDoubleClick={canEdit ? handleRowDoubleClick : undefined}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="sidebar-project-title">{name}</span>
    </button>
  )
}

function ProjectRowActions({
  actionMenuId,
  actionMenuOpen,
  isDragging,
  isEditing,
  name,
  onCreateSession,
  onToggleActions,
  showActions,
}: Pick<
  ProjectRowProps,
  | 'actionMenuId'
  | 'actionMenuOpen'
  | 'isDragging'
  | 'isEditing'
  | 'name'
  | 'onCreateSession'
  | 'onToggleActions'
  | 'showActions'
>) {
  return (
    <div
      className="sidebar-project-actions"
      data-open={actionMenuOpen ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
      data-editing={isEditing ? 'true' : 'false'}
      data-visible={showActions ? 'true' : 'false'}
    >
      <Tooltip content="New session" placement="right">
        <button
          type="button"
          className={compactIconButtonClass}
          onClick={onCreateSession}
          aria-label={`Start a new session in ${name}`}
        >
          <Plus size={14} />
        </button>
      </Tooltip>
      <Tooltip content="Project actions" placement="right">
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            actionMenuOpen && 'bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]',
          )}
          onClick={onToggleActions}
          aria-label="Project actions"
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

export function ProjectRow({
  actionMenuId,
  actionMenuOpen,
  dragHandleProps,
  canEdit,
  canToggleExpanded,
  isActive,
  isDragging,
  isExpanded,
  hasRepoOrigin,
  name,
  renameDraft,
  isEditing,
  showActions,
  threadGroupId,
  onCancelEdit,
  onChangeRenameDraft,
  onEdit,
  onCreateSession,
  onSelect,
  onSubmitEdit,
  onToggleActions,
  onToggleExpanded,
}: ProjectRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const clickTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isEditing) {
      return
    }

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  useEffect(() => {
    return () => clearClickTimeout(clickTimeoutRef)
  }, [])

  const handleRowClick = () => {
    clearClickTimeout(clickTimeoutRef)
    clickTimeoutRef.current = window.setTimeout(() => {
      onSelect()
      if (canToggleExpanded) {
        onToggleExpanded()
      }
      clickTimeoutRef.current = null
    }, 180)
  }

  const handleRowDoubleClick = () => {
    clearClickTimeout(clickTimeoutRef)
    if (canEdit) {
      onEdit()
    }
  }

  return (
    <div
      className="sidebar-row-surface sidebar-project-row"
      data-highlighted={isActive || actionMenuOpen ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
    >
      <Tooltip content={isExpanded ? 'Collapse folder' : 'Expand folder'} placement="right">
        <button
          type="button"
          className="sidebar-project-toggle"
          onClick={canToggleExpanded ? onToggleExpanded : undefined}
          data-can-toggle={canToggleExpanded ? 'true' : 'false'}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          aria-expanded={isExpanded}
          aria-controls={threadGroupId}
          disabled={!canToggleExpanded}
        >
          {hasRepoOrigin ? (
            <Github size={12} className="sidebar-project-icon sidebar-project-origin-icon" />
          ) : (
            <Folder size={12} className="sidebar-project-icon sidebar-project-origin-icon" />
          )}
          {isExpanded ? (
            <ChevronDown size={12} className="sidebar-project-icon sidebar-project-chevron-icon" />
          ) : (
            <ChevronRight size={12} className="sidebar-project-icon sidebar-project-chevron-icon" />
          )}
        </button>
      </Tooltip>

      <ProjectRowName
        canEdit={canEdit}
        dragHandleProps={dragHandleProps}
        handleRowClick={handleRowClick}
        handleRowDoubleClick={handleRowDoubleClick}
        inputRef={inputRef}
        isActive={isActive}
        isEditing={isEditing}
        name={name}
        onCancelEdit={onCancelEdit}
        onChangeRenameDraft={onChangeRenameDraft}
        onSubmitEdit={onSubmitEdit}
        renameDraft={renameDraft}
      />

      <ProjectRowActions
        actionMenuId={actionMenuId}
        actionMenuOpen={actionMenuOpen}
        isDragging={isDragging}
        isEditing={isEditing}
        name={name}
        onCreateSession={onCreateSession}
        onToggleActions={onToggleActions}
        showActions={showActions}
      />
    </div>
  )
}
