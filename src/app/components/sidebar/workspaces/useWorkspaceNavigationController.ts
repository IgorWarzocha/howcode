import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { type DragEvent, useMemo, useState } from 'react'
import type {
  DesktopActionInvoker,
  WorkspaceChat,
  WorkspaceNavigationState,
} from '../../../desktop/types'
import { useDirectoryMenuDismiss } from '../directory-tree/useDirectoryMenuDismiss'
import { workspaceChatDragType } from './workspace-chat-item'

type UseWorkspaceNavigationControllerInput = {
  chatState: WorkspaceNavigationState | null
  onCreateWorkspace: (name: string) => Promise<unknown>
  onAction: DesktopActionInvoker
}

const EMPTY_WORKSPACES: [] = []

export function useWorkspaceNavigationController({
  chatState,
  onCreateWorkspace,
  onAction,
}: UseWorkspaceNavigationControllerInput) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [openWorkspaceMenuId, setOpenWorkspaceMenuId] = useState<string | null>(null)
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
  const [draggingWorkspaceId, setDraggingWorkspaceId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const { containerRef } = useDirectoryMenuDismiss(openWorkspaceMenuId !== null, () =>
    setOpenWorkspaceMenuId(null),
  )
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const sourceWorkspaces = chatState?.workspaces ?? EMPTY_WORKSPACES
  const workspaces = useMemo(() => {
    if (!normalizedSearchQuery) return sourceWorkspaces
    return sourceWorkspaces.flatMap((workspace) => {
      const workspaceMatches = workspace.name.toLowerCase().includes(normalizedSearchQuery)
      const matchingChats = workspace.chats.filter((chat) =>
        chat.title.toLowerCase().includes(normalizedSearchQuery),
      )
      if (!workspaceMatches && matchingChats.length === 0) return []
      return [{ ...workspace, chats: workspaceMatches ? workspace.chats : matchingChats }]
    })
  }, [normalizedSearchQuery, sourceWorkspaces])
  const unassignedChats = useMemo(() => {
    const chats = chatState?.unassignedChats ?? []
    if (!normalizedSearchQuery) return chats
    return chats.filter((chat) => chat.title.toLowerCase().includes(normalizedSearchQuery))
  }, [chatState?.unassignedChats, normalizedSearchQuery])
  const workspaceIds = useMemo(() => workspaces.map((workspace) => workspace.id), [workspaces])

  const submitWorkspace = async () => {
    const name = draft.trim()
    if (!name) return
    await onCreateWorkspace(name)
    setDraft('')
    setCreating(false)
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (normalizedSearchQuery) return
    setDraggingWorkspaceId(typeof event.active.id === 'string' ? event.active.id : null)
    setOpenWorkspaceMenuId(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingWorkspaceId(null)
    if (normalizedSearchQuery) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sourceWorkspaces.findIndex((workspace) => workspace.id === active.id)
    const newIndex = sourceWorkspaces.findIndex((workspace) => workspace.id === over.id)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
    const nextWorkspaces = arrayMove(sourceWorkspaces, oldIndex, newIndex)
    void onAction('workspace.reorder', {
      workspaceIds: nextWorkspaces.map((workspace) => workspace.id),
    })
  }

  const handleStartEdit = (workspaceId: string, workspaceName: string) => {
    setOpenWorkspaceMenuId(null)
    setEditingWorkspaceId(workspaceId)
    setRenameDraft(workspaceName)
  }

  const handleCancelEdit = () => {
    setEditingWorkspaceId(null)
    setRenameDraft('')
  }

  const handleSubmitEdit = (workspaceId: string) => {
    const nextName = renameDraft.trim()
    if (!nextName) {
      handleCancelEdit()
      return
    }
    const directoryId = sourceWorkspaces.find(
      (workspace) => workspace.id === workspaceId,
    )?.directoryId
    if (directoryId)
      void onAction('directory.edit-name', { directoryId: directoryId, directoryName: nextName })
    else void onAction('workspace.rename', { workspaceId: workspaceId, value: nextName })
    setEditingWorkspaceId(null)
    setRenameDraft('')
  }

  const moveChat = (chat: WorkspaceChat, workspaceId: string | null) => {
    if (!chat.conversationId) return
    void onAction('chat.move', {
      conversationId: chat.conversationId,
      workspaceId: workspaceId,
    })
  }

  const getDraggedChat = (draggedChatId: string) => {
    const allChats = [
      ...(chatState?.unassignedChats ?? []),
      ...sourceWorkspaces.flatMap((workspace) => workspace.chats),
    ]
    return allChats.find((candidate) => candidate.id === draggedChatId) ?? null
  }

  const handleChatDrop = (event: DragEvent, workspaceId: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    const draggedChatId = event.dataTransfer.getData(workspaceChatDragType)
    const draggedChat = getDraggedChat(draggedChatId)
    if (draggedChat) moveChat(draggedChat, workspaceId)
  }

  return {
    containerRef,
    creating,
    draft,
    draggingWorkspaceId,
    editingWorkspaceId,
    workspaceIds,
    workspaces,
    handleCancelEdit,
    handleDragEnd,
    handleDragStart,
    handleStartEdit,
    handleSubmitEdit,
    handleChatDrop,
    openWorkspaceMenuId,
    renameDraft,
    searchQuery,
    sensors,
    setCreating,
    setDraft,
    setDraggingWorkspaceId,
    setOpenWorkspaceMenuId,
    setRenameDraft,
    setSearchQuery,
    submitWorkspace,
    unassignedChats,
  }
}
