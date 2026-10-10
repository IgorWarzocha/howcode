import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { DEFAULT_WORKSPACE_ID } from '../../../../../shared/desktop-workspace-contracts'

type SortableWorkspaceItemProps = {
  workspaceId: string
  children: (input: {
    dragHandleProps: {
      attributes: DraggableAttributes
      listeners: DraggableSyntheticListeners | undefined
    }
    isDragging: boolean
  }) => ReactNode
}

export function SortableWorkspaceItem({ workspaceId, children }: SortableWorkspaceItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: workspaceId,
    disabled: workspaceId === DEFAULT_WORKSPACE_ID,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'z-20 opacity-80' : undefined}
    >
      {children({ dragHandleProps: { attributes, listeners }, isDragging })}
    </div>
  )
}
