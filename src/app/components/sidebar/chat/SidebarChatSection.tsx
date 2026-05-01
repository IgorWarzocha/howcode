import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Edit2, FolderPlus, Plus, Search } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import type {
  ChatGroup,
  ChatSidebarState,
  ChatThread,
  DesktopActionInvoker,
} from "../../../desktop/types";
import { SurfacePanel } from "../../common/SurfacePanel";
import { IconButton } from "../../common/IconButton";
import { ChatGroupRow } from "./ChatGroupRow";
import { chatThreadDragType, ChatThreadDropItem } from "./ChatThreadDropItem";
import { SortableGroupItem } from "./SortableGroupItem";
import { useProjectMenuDismiss } from "../project-tree/useProjectMenuDismiss";

type SidebarChatSectionProps = {
  chatState: ChatSidebarState | null;
  selectedGroupId: string | null;
  selectedThreadId: string | null;
  onCreateGroup: (name: string) => Promise<unknown>;
  onSelectGroup: (groupId: string | null) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onNewChat: (groupId: string | null) => void;
  onRefresh: () => Promise<unknown>;
  onAction: DesktopActionInvoker;
};

export function SidebarChatSection({
  chatState,
  selectedGroupId,
  selectedThreadId,
  onCreateGroup,
  onSelectGroup,
  onThreadOpen,
  onNewChat,
  onRefresh,
  onAction,
}: SidebarChatSectionProps) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [openGroupMenuId, setOpenGroupMenuId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { containerRef } = useProjectMenuDismiss(openGroupMenuId !== null, () =>
    setOpenGroupMenuId(null),
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const sourceGroups = chatState?.groups ?? [];
  const groups = useMemo(() => {
    if (!normalizedSearchQuery) return sourceGroups;
    return sourceGroups.flatMap((group) => {
      const groupMatches = group.name.toLowerCase().includes(normalizedSearchQuery);
      const matchingThreads = group.threads.filter((thread) =>
        thread.title.toLowerCase().includes(normalizedSearchQuery),
      );
      if (!groupMatches && matchingThreads.length === 0) return [];
      return [{ ...group, threads: groupMatches ? group.threads : matchingThreads }];
    });
  }, [normalizedSearchQuery, sourceGroups]);
  const ungroupedThreads = useMemo(() => {
    const threads = chatState?.ungroupedThreads ?? [];
    if (!normalizedSearchQuery) return threads;
    return threads.filter((thread) => thread.title.toLowerCase().includes(normalizedSearchQuery));
  }, [chatState?.ungroupedThreads, normalizedSearchQuery]);
  const groupIds = useMemo(() => groups.map((group) => group.id), [groups]);

  const submitGroup = async () => {
    const name = draft.trim();
    if (!name) return;
    await onCreateGroup(name);
    setDraft("");
    setCreating(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (normalizedSearchQuery) return;
    setDraggingGroupId(typeof event.active.id === "string" ? event.active.id : null);
    setOpenGroupMenuId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingGroupId(null);
    if (normalizedSearchQuery) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sourceGroups.findIndex((group) => group.id === active.id);
    const newIndex = sourceGroups.findIndex((group) => group.id === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const nextGroups = arrayMove(sourceGroups, oldIndex, newIndex);
    void onAction("chat.group.reorder", { chatGroupIds: nextGroups.map((group) => group.id) }).then(
      onRefresh,
    );
  };

  const handleStartEdit = (groupId: string, groupName: string) => {
    setOpenGroupMenuId(null);
    setEditingGroupId(groupId);
    setRenameDraft(groupName);
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setRenameDraft("");
  };

  const handleSubmitEdit = (groupId: string) => {
    const nextName = renameDraft.trim();
    if (!nextName) {
      handleCancelEdit();
      return;
    }
    void onAction("chat.group.rename", { chatGroupId: groupId, value: nextName }).then(onRefresh);
    setEditingGroupId(null);
    setRenameDraft("");
  };

  const moveThread = (thread: ChatThread, groupId: string | null) => {
    if (!thread.sessionPath) return;
    void onAction("chat.thread.move", {
      sessionPath: thread.sessionPath,
      chatGroupId: groupId,
    }).then(onRefresh);
  };

  const getDraggedThread = (draggedThreadId: string) => {
    const allThreads = [
      ...(chatState?.ungroupedThreads ?? []),
      ...sourceGroups.flatMap((group) => group.threads),
    ];
    return allThreads.find((candidate) => candidate.id === draggedThreadId) ?? null;
  };

  const handleThreadDrop = (event: DragEvent, groupId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedThreadId = event.dataTransfer.getData(chatThreadDragType);
    const draggedThread = getDraggedThread(draggedThreadId);
    if (draggedThread) moveThread(draggedThread, groupId);
  };

  const renderThread = (thread: ChatThread, groupId: string | null) => (
    <ChatThreadDropItem
      key={thread.id}
      thread={thread}
      groupId={groupId}
      selectedThreadId={selectedThreadId}
      onAction={onAction}
      onRefresh={onRefresh}
      onThreadDrop={handleThreadDrop}
      onThreadOpen={onThreadOpen}
    />
  );

  return (
    <div ref={containerRef} className="sidebar-project-tree">
      <div className="sidebar-toolbar mb-2">
        <label
          className="sidebar-search-field"
          data-active={searchQuery.trim().length > 0 ? "true" : "false"}
        >
          <Search size={14} className="sidebar-search-icon" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            className="sidebar-search-input"
            aria-label="Search chats"
          />
        </label>
        <div className="sidebar-action-group">
          <IconButton
            label="New group"
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
            event.preventDefault();
            void submitGroup();
          }}
        >
          <input
            className="sidebar-project-input w-full"
            value={draft}
            placeholder="Group name"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setCreating(false);
            }}
          />
        </form>
      ) : null}

      <div className="sidebar-tree-item mb-2">
        <button
          type="button"
          className="sidebar-row-surface sidebar-project-row w-full"
          onClick={() => {
            onSelectGroup(null);
            onNewChat(null);
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

      <div
        className="sidebar-tree-item"
        id="chat-ungrouped-threads"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleThreadDrop(event, null)}
      >
        {ungroupedThreads.map((thread) => renderThread(thread, null))}
      </div>

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
            const isExpanded = !group.collapsed;
            const effectiveIsExpanded = isExpanded && draggingGroupId !== group.id;
            const groupMenuOpen = openGroupMenuId === group.id;
            const threadGroupId = `chat-group-threads-${group.id}`;
            const actionMenuId = `chat-group-actions-${group.id}`;

            return (
              <SortableGroupItem key={group.id} groupId={group.id}>
                {({ dragHandleProps, isDragging }) => (
                  <div
                    className="sidebar-tree-item"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleThreadDrop(event, group.id)}
                  >
                    <div className="relative">
                      <ChatGroupRow
                        actionMenuId={actionMenuId}
                        actionMenuOpen={groupMenuOpen}
                        dragHandleProps={dragHandleProps}
                        isActive={selectedGroupId === group.id}
                        isDragging={isDragging}
                        isExpanded={effectiveIsExpanded}
                        name={group.name}
                        renameDraft={renameDraft}
                        isEditing={editingGroupId === group.id}
                        threadGroupId={threadGroupId}
                        onCancelEdit={handleCancelEdit}
                        onChangeRenameDraft={setRenameDraft}
                        onCreateSession={() => {
                          onSelectGroup(group.id);
                          onNewChat(group.id);
                          setOpenGroupMenuId(null);
                        }}
                        onEdit={() => handleStartEdit(group.id, group.name)}
                        onSelect={() => {
                          onSelectGroup(group.id);
                          setOpenGroupMenuId(null);
                        }}
                        onSubmitEdit={() => handleSubmitEdit(group.id)}
                        onToggleActions={() =>
                          setOpenGroupMenuId((current) => (current === group.id ? null : group.id))
                        }
                        onToggleExpanded={() =>
                          void onAction("chat.group.collapse", {
                            chatGroupId: group.id,
                            value: !group.collapsed,
                          }).then(onRefresh)
                        }
                      />

                      {groupMenuOpen && editingGroupId !== group.id ? (
                        <SurfacePanel
                          id={actionMenuId}
                          role="menu"
                          aria-label="Group actions"
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
                        </SurfacePanel>
                      ) : null}
                    </div>

                    {effectiveIsExpanded ? (
                      <div
                        id={threadGroupId}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleThreadDrop(event, group.id)}
                      >
                        {group.threads.map((thread) => renderThread(thread, group.id))}
                      </div>
                    ) : null}
                  </div>
                )}
              </SortableGroupItem>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}
