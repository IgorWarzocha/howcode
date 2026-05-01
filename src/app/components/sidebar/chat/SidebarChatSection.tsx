import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatGroup,
  ChatSidebarState,
  ChatThread,
  DesktopActionInvoker,
} from "../../../desktop/types";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { SurfacePanel } from "../../common/SurfacePanel";
import { Tooltip } from "../../common/Tooltip";
import { IconButton } from "../../common/IconButton";
import { ThreadRow } from "../project-tree/ThreadRow";
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

type SortableGroupItemProps = {
  groupId: string;
  children: (input: {
    dragHandleProps: {
      attributes: DraggableAttributes;
      listeners: DraggableSyntheticListeners | undefined;
    };
    isDragging: boolean;
  }) => ReactNode;
};

function SortableGroupItem({ groupId, children }: SortableGroupItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: groupId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "z-20 opacity-80" : undefined}
    >
      {children({ dragHandleProps: { attributes, listeners }, isDragging })}
    </div>
  );
}

type ChatGroupRowProps = {
  actionMenuId: string;
  actionMenuOpen: boolean;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners | undefined;
  };
  isActive: boolean;
  isDragging: boolean;
  isExpanded: boolean;
  name: string;
  renameDraft: string;
  isEditing: boolean;
  threadGroupId: string;
  onCancelEdit: () => void;
  onChangeRenameDraft: (value: string) => void;
  onCreateSession: () => void;
  onEdit: () => void;
  onSelect: () => void;
  onSubmitEdit: () => void;
  onToggleActions: () => void;
  onToggleExpanded: () => void;
};

function ChatGroupRow({
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
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) window.clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  const handleRowClick = () => {
    if (clickTimeoutRef.current !== null) window.clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = window.setTimeout(() => {
      onSelect();
      onToggleExpanded();
      clickTimeoutRef.current = null;
    }, 180);
  };

  const handleRowDoubleClick = () => {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    onEdit();
  };

  return (
    <div
      className="sidebar-row-surface sidebar-project-row"
      data-highlighted={isActive || actionMenuOpen ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
    >
      <Tooltip content={isExpanded ? "Collapse group" : "Expand group"} placement="right">
        <button
          type="button"
          className="sidebar-project-toggle"
          onClick={onToggleExpanded}
          data-can-toggle="true"
          aria-label={isExpanded ? "Collapse group" : "Expand group"}
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
        <div className="sidebar-project-edit">
          <input
            ref={inputRef}
            value={renameDraft}
            onChange={(event) => onChangeRenameDraft(event.target.value)}
            onBlur={onCancelEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitEdit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelEdit();
              }
            }}
            className="sidebar-project-input"
            aria-label={`Rename ${name}`}
          />
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "sidebar-project-button",
            dragHandleProps ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          )}
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
          onClick={handleRowClick}
          onDoubleClick={handleRowDoubleClick}
          data-active={isActive ? "true" : "false"}
          aria-current={isActive ? "page" : undefined}
        >
          <span className="sidebar-project-title">{name}</span>
        </button>
      )}

      <div
        className="sidebar-project-actions"
        data-open={actionMenuOpen ? "true" : "false"}
        data-dragging={isDragging ? "true" : "false"}
        data-editing={isEditing ? "true" : "false"}
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
              actionMenuOpen && "bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
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
    </div>
  );
}

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
    const draggedThreadId = event.dataTransfer.getData("application/howcode-chat-thread");
    const draggedThread = getDraggedThread(draggedThreadId);
    if (draggedThread) moveThread(draggedThread, groupId);
  };

  const renderThread = (thread: ChatThread, groupId: string | null) => (
    <div
      key={thread.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/howcode-chat-thread", thread.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => handleThreadDrop(event, groupId)}
    >
      <ThreadRow
        age={thread.age}
        pinned={Boolean(thread.pinned)}
        running={Boolean(thread.running)}
        terminalRunning={false}
        unread={Boolean(thread.unread)}
        isSelected={selectedThreadId === thread.id}
        title={thread.title}
        onArchive={() => void onAction("thread.archive", { threadId: thread.id }).then(onRefresh)}
        onOpen={() =>
          thread.sessionPath && onThreadOpen(thread.projectId, thread.id, thread.sessionPath)
        }
        onPin={() => void onAction("thread.pin", { threadId: thread.id }).then(onRefresh)}
      />
    </div>
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
