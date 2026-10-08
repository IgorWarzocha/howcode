import { closestCorners, DndContext } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { IconButton } from '@howcode/common/icon-button'
import { PopoverPanel } from '@howcode/common/popover'
import { Edit2, FolderPlus, Plus, Search } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type {
  ChatGroup,
  ChatSidebarState,
  ChatThread,
  DesktopActionInvoker,
} from '../../../desktop/types'
import { ChatGroupRow } from './chat-group-row'
import { ChatThreadDropItem } from './chat-thread-drop-item'
import { SortableGroupItem } from './sortable-group-item'
import { useChatSidebarController } from './useChatSidebarController'

type SidebarChatSectionProps = {
  chatState: ChatSidebarState | null
  selectedGroupId: string | null
  selectedThreadId: string | null
  onCreateGroup: (name: string) => Promise<unknown>
  onSelectGroup: (groupId: string | null) => void
  onThreadOpen: (projectId: string, threadId: string, conversationId: string) => void
  onNewChat: (groupId: string | null) => void
  onAction: DesktopActionInvoker
  onSelectDirectory: (directoryId: string) => void
  onShowWorkspace: () => void
  folderCreation?: ReactNode
  renderDirectoryTools?: (directoryId: string) => ReactNode
}

export function SidebarChatSection({
  chatState,
  selectedGroupId,
  selectedThreadId,
  onCreateGroup,
  onSelectGroup,
  onThreadOpen,
  onNewChat,
  onAction,
  onSelectDirectory,
  onShowWorkspace,
  folderCreation,
  renderDirectoryTools,
}: SidebarChatSectionProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const {
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
  } = useChatSidebarController({ chatState, onCreateGroup, onAction })

  useHowcodeKeybindingCommand('sidebar.find', (event) => {
    event.preventDefault()
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  const activeGroupId =
    groups.find((group) => group.threads.some((thread) => thread.id === selectedThreadId))?.id ??
    selectedGroupId

  const renderThread = (thread: ChatThread, groupId: string | null) => (
    <ChatThreadDropItem
      key={thread.id}
      thread={thread}
      groupId={groupId}
      selectedThreadId={selectedThreadId}
      onAction={onAction}
      onThreadDrop={handleThreadDrop}
      onThreadOpen={onThreadOpen}
    />
  )

  return (
    <div ref={containerRef} className="sidebar-project-tree">
      <div className="sidebar-toolbar sidebar-toolbar--chat mb-2">
        <label
          className="sidebar-search-field"
          data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
        >
          <Search size={14} className="sidebar-search-icon" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            className="sidebar-search-input"
            aria-label="Search chats"
          />
        </label>
        <div className="sidebar-action-group">
          {folderCreation}
          <IconButton
            label="New workspace"
            tooltipPlacement="right"
            onClick={() => setCreating((current) => !current)}
            icon={<FolderPlus size={15} />}
          />
        </div>
      </div>
      {creating ? (
        <form
          className="mb-2 px-1"
          onSubmit={(event) => {
            event.preventDefault()
            void submitGroup()
          }}
        >
          <input
            className="sidebar-project-input w-full"
            aria-label="Workspace name"
            value={draft}
            placeholder="Workspace name"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCreating(false)
            }}
          />
        </form>
      ) : null}
      <div className="sidebar-tree-item mb-2">
        <button
          type="button"
          className="sidebar-row-surface sidebar-project-row w-full"
          onClick={() => {
            onSelectGroup(null)
            onNewChat(null)
          }}
        >
          <span className="sidebar-project-toggle" data-can-toggle="false">
            <Plus size={14} className="sidebar-project-icon sidebar-project-origin-icon" />
          </span>
          <span className="sidebar-project-button cursor-pointer">
            <span className="sidebar-project-title">New chat</span>
          </span>
        </button>
      </div>
      <ul
        className="sidebar-tree-item"
        id="chat-ungrouped-threads"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleThreadDrop(event, null)}
      >
        {ungroupedThreads.map((thread) => renderThread(thread, null))}
      </ul>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggingGroupId(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          {groups.map((group: ChatGroup) => {
            const isExpanded = !group.collapsed
            const effectiveIsExpanded = isExpanded && draggingGroupId !== group.id
            const groupMenuOpen = openGroupMenuId === group.id
            const threadGroupId = `chat-group-threads-${group.id}`
            const actionMenuId = `chat-group-actions-${group.id}`

            return (
              <SortableGroupItem key={group.id} groupId={group.id}>
                {({ dragHandleProps, isDragging }) => (
                  <ul
                    className="sidebar-tree-item"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleThreadDrop(event, group.id)}
                  >
                    <div className="relative">
                      <ChatGroupRow
                        actionMenuId={actionMenuId}
                        actionMenuOpen={groupMenuOpen}
                        dragHandleProps={dragHandleProps}
                        isActive={activeGroupId === group.id}
                        isDragging={isDragging}
                        isExpanded={effectiveIsExpanded}
                        name={group.name}
                        renameDraft={renameDraft}
                        isEditing={editingGroupId === group.id}
                        threadGroupId={threadGroupId}
                        onCancelEdit={handleCancelEdit}
                        onChangeRenameDraft={setRenameDraft}
                        onCreateSession={() => {
                          onSelectGroup(group.id)
                          onNewChat(group.id)
                          setOpenGroupMenuId(null)
                        }}
                        onEdit={() => handleStartEdit(group.id, group.name)}
                        onSelect={() => {
                          onSelectGroup(group.id)
                          if (group.directoryId) onSelectDirectory(group.directoryId)
                          else onShowWorkspace()
                          setOpenGroupMenuId(null)
                        }}
                        onSubmitEdit={() => handleSubmitEdit(group.id)}
                        onToggleActions={() =>
                          setOpenGroupMenuId((current) => (current === group.id ? null : group.id))
                        }
                        onToggleExpanded={() =>
                          void onAction('chat.group.collapse', {
                            chatGroupId: group.id,
                            value: !group.collapsed,
                          })
                        }
                      />

                      {groupMenuOpen && editingGroupId !== group.id ? (
                        <PopoverPanel
                          id={actionMenuId}
                          role="menu"
                          aria-label="Workspace actions"
                          className="sidebar-popover-panel sidebar-project-action-menu"
                        >
                          <div className="sidebar-project-menu-list">
                            <button
                              className="sidebar-project-menu-item"
                              onClick={() => handleStartEdit(group.id, group.name)}
                              role="menuitem"
                              type="button"
                            >
                              <span className="sidebar-project-menu-item__icon">
                                <Edit2 size={14} />
                              </span>
                              <span className="truncate text-left">Rename</span>
                            </button>
                          </div>
                        </PopoverPanel>
                      ) : null}
                    </div>

                    {effectiveIsExpanded ? (
                      <ul
                        id={threadGroupId}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleThreadDrop(event, group.id)}
                      >
                        {group.threads.map((thread) => renderThread(thread, group.id))}
                        {group.directoryId && activeGroupId === group.id
                          ? renderDirectoryTools?.(group.directoryId)
                          : null}
                      </ul>
                    ) : null}
                  </ul>
                )}
              </SortableGroupItem>
            )
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}
