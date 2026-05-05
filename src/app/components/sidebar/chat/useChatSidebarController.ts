import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { type DragEvent, useMemo, useState } from 'react'
import type { ChatSidebarState, ChatThread, DesktopActionInvoker } from '../../../desktop/types'
import { useProjectMenuDismiss } from '../project-tree/useProjectMenuDismiss'
import { chatThreadDragType } from './chat-thread-drop-item'

type UseChatSidebarControllerInput = {
  chatState: ChatSidebarState | null
  onCreateGroup: (name: string) => Promise<unknown>
  onRefresh: () => Promise<unknown>
  onAction: DesktopActionInvoker
}

export function useChatSidebarController({
  chatState,
  onCreateGroup,
  onRefresh,
  onAction,
}: UseChatSidebarControllerInput) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [openGroupMenuId, setOpenGroupMenuId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const { containerRef } = useProjectMenuDismiss(openGroupMenuId !== null, () =>
    setOpenGroupMenuId(null),
  )
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const sourceGroups = chatState?.groups ?? []
  const groups = useMemo(() => {
    if (!normalizedSearchQuery) return sourceGroups
    return sourceGroups.flatMap((group) => {
      const groupMatches = group.name.toLowerCase().includes(normalizedSearchQuery)
      const matchingThreads = group.threads.filter((thread) =>
        thread.title.toLowerCase().includes(normalizedSearchQuery),
      )
      if (!groupMatches && matchingThreads.length === 0) return []
      return [{ ...group, threads: groupMatches ? group.threads : matchingThreads }]
    })
  }, [normalizedSearchQuery, sourceGroups])
  const ungroupedThreads = useMemo(() => {
    const threads = chatState?.ungroupedThreads ?? []
    if (!normalizedSearchQuery) return threads
    return threads.filter((thread) => thread.title.toLowerCase().includes(normalizedSearchQuery))
  }, [chatState?.ungroupedThreads, normalizedSearchQuery])
  const groupIds = useMemo(() => groups.map((group) => group.id), [groups])

  const submitGroup = async () => {
    const name = draft.trim()
    if (!name) return
    await onCreateGroup(name)
    setDraft('')
    setCreating(false)
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (normalizedSearchQuery) return
    setDraggingGroupId(typeof event.active.id === 'string' ? event.active.id : null)
    setOpenGroupMenuId(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingGroupId(null)
    if (normalizedSearchQuery) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sourceGroups.findIndex((group) => group.id === active.id)
    const newIndex = sourceGroups.findIndex((group) => group.id === over.id)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
    const nextGroups = arrayMove(sourceGroups, oldIndex, newIndex)
    void onAction('chat.group.reorder', { chatGroupIds: nextGroups.map((group) => group.id) }).then(
      onRefresh,
    )
  }

  const handleStartEdit = (groupId: string, groupName: string) => {
    setOpenGroupMenuId(null)
    setEditingGroupId(groupId)
    setRenameDraft(groupName)
  }

  const handleCancelEdit = () => {
    setEditingGroupId(null)
    setRenameDraft('')
  }

  const handleSubmitEdit = (groupId: string) => {
    const nextName = renameDraft.trim()
    if (!nextName) {
      handleCancelEdit()
      return
    }
    void onAction('chat.group.rename', { chatGroupId: groupId, value: nextName }).then(onRefresh)
    setEditingGroupId(null)
    setRenameDraft('')
  }

  const moveThread = (thread: ChatThread, groupId: string | null) => {
    if (!thread.sessionPath) return
    void onAction('chat.thread.move', {
      sessionPath: thread.sessionPath,
      chatGroupId: groupId,
    }).then(onRefresh)
  }

  const getDraggedThread = (draggedThreadId: string) => {
    const allThreads = [
      ...(chatState?.ungroupedThreads ?? []),
      ...sourceGroups.flatMap((group) => group.threads),
    ]
    return allThreads.find((candidate) => candidate.id === draggedThreadId) ?? null
  }

  const handleThreadDrop = (event: DragEvent, groupId: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    const draggedThreadId = event.dataTransfer.getData(chatThreadDragType)
    const draggedThread = getDraggedThread(draggedThreadId)
    if (draggedThread) moveThread(draggedThread, groupId)
  }

  return {
    containerRef,
    creating,
    draft,
    draggingGroupId,
    editingGroupId,
    groupIds,
    groups,
    handleCancelEdit,
    handleDragEnd,
    handleDragStart,
    handleStartEdit,
    handleSubmitEdit,
    handleThreadDrop,
    openGroupMenuId,
    renameDraft,
    searchQuery,
    sensors,
    setCreating,
    setDraft,
    setDraggingGroupId,
    setOpenGroupMenuId,
    setRenameDraft,
    setSearchQuery,
    submitGroup,
    ungroupedThreads,
  }
}
