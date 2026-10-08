import { closestCorners, DndContext } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { IconButton } from '@howcode/common/icon-button'
import { PopoverPanel } from '@howcode/common/popover'
import { Edit2, FolderPlus, Plus, Search } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type {
  DesktopActionInvoker,
  Workspace,
  WorkspaceChat,
  WorkspaceNavigationState,
} from '../../../desktop/types'
import { SortableWorkspaceItem } from './sortable-workspace-item'
import { useWorkspaceNavigationController } from './useWorkspaceNavigationController'
import { WorkspaceChatItem } from './workspace-chat-item'
import { WorkspaceRow } from './workspace-row'

type WorkspaceNavigationSectionProps = {
  chatState: WorkspaceNavigationState | null
  selectedWorkspaceId: string | null
  selectedChatId: string | null
  onCreateWorkspace: (name: string) => Promise<unknown>
  onSelectWorkspace: (workspaceId: string | null) => void
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
  onNewChat: (workspaceId: string | null) => void
  onAction: DesktopActionInvoker
  folderCreation?: ReactNode
  renderDirectoryTools?: (directoryId: string) => ReactNode
}

export function WorkspaceNavigationSection({
  chatState,
  selectedWorkspaceId,
  selectedChatId,
  onCreateWorkspace,
  onSelectWorkspace,
  onChatOpen,
  onNewChat,
  onAction,
  folderCreation,
  renderDirectoryTools,
}: WorkspaceNavigationSectionProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const {
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
  } = useWorkspaceNavigationController({ chatState, onCreateWorkspace, onAction })

  useHowcodeKeybindingCommand('sidebar.find', (event) => {
    event.preventDefault()
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  const activeWorkspaceId =
    workspaces.find((workspace) => workspace.chats.some((chat) => chat.id === selectedChatId))
      ?.id ?? selectedWorkspaceId

  const renderChat = (chat: WorkspaceChat, workspaceId: string | null) => (
    <WorkspaceChatItem
      key={chat.id}
      chat={chat}
      workspaceId={workspaceId}
      selectedChatId={selectedChatId}
      onAction={onAction}
      onChatDrop={handleChatDrop}
      onChatOpen={onChatOpen}
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
            void submitWorkspace()
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
            onSelectWorkspace(null)
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
        id="workspace-unassigned-chats"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleChatDrop(event, null)}
      >
        {unassignedChats.map((chat) => renderChat(chat, null))}
      </ul>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggingWorkspaceId(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={workspaceIds} strategy={verticalListSortingStrategy}>
          {workspaces.map((workspace: Workspace) => {
            const isExpanded = !workspace.collapsed
            const effectiveIsExpanded = isExpanded && draggingWorkspaceId !== workspace.id
            const workspaceMenuOpen = openWorkspaceMenuId === workspace.id
            const workspaceId = `chat-workspace-threads-${workspace.id}`
            const actionMenuId = `chat-workspace-actions-${workspace.id}`

            return (
              <SortableWorkspaceItem key={workspace.id} workspaceId={workspace.id}>
                {({ dragHandleProps, isDragging }) => (
                  <ul
                    className="sidebar-tree-item"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleChatDrop(event, workspace.id)}
                  >
                    <div className="relative">
                      <WorkspaceRow
                        actionMenuId={actionMenuId}
                        actionMenuOpen={workspaceMenuOpen}
                        dragHandleProps={dragHandleProps}
                        isActive={activeWorkspaceId === workspace.id}
                        isDragging={isDragging}
                        isExpanded={effectiveIsExpanded}
                        name={workspace.name}
                        renameDraft={renameDraft}
                        isEditing={editingWorkspaceId === workspace.id}
                        workspaceId={workspaceId}
                        onCancelEdit={handleCancelEdit}
                        onChangeRenameDraft={setRenameDraft}
                        onCreateSession={() => {
                          onSelectWorkspace(workspace.id)
                          onNewChat(workspace.id)
                          setOpenWorkspaceMenuId(null)
                        }}
                        onEdit={() => handleStartEdit(workspace.id, workspace.name)}
                        onSelect={() => {
                          onSelectWorkspace(workspace.id)
                          setOpenWorkspaceMenuId(null)
                        }}
                        onSubmitEdit={() => handleSubmitEdit(workspace.id)}
                        onToggleActions={() =>
                          setOpenWorkspaceMenuId((current) =>
                            current === workspace.id ? null : workspace.id,
                          )
                        }
                        onToggleExpanded={() =>
                          void onAction('workspace.collapse', {
                            workspaceId: workspace.id,
                            value: !workspace.collapsed,
                          })
                        }
                      />

                      {workspaceMenuOpen && editingWorkspaceId !== workspace.id ? (
                        <PopoverPanel
                          id={actionMenuId}
                          role="menu"
                          aria-label="Workspace actions"
                          className="sidebar-popover-panel sidebar-project-action-menu"
                        >
                          <div className="sidebar-project-menu-list">
                            <button
                              className="sidebar-project-menu-item"
                              onClick={() => handleStartEdit(workspace.id, workspace.name)}
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
                        id={workspaceId}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleChatDrop(event, workspace.id)}
                      >
                        {workspace.chats.map((chat) => renderChat(chat, workspace.id))}
                        {workspace.directoryId && activeWorkspaceId === workspace.id
                          ? renderDirectoryTools?.(workspace.directoryId)
                          : null}
                      </ul>
                    ) : null}
                  </ul>
                )}
              </SortableWorkspaceItem>
            )
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}
