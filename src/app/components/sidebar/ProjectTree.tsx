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
import { Plus } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { DesktopActionInvoker } from "../../desktop/types";
import { useAnimatedPresence } from "../../hooks/useAnimatedPresence";
import type { Project, View } from "../../types";
import { ProjectActionMenu } from "./ProjectActionMenu";
import { EmptyThreadsState } from "./project-tree/EmptyThreadsState";
import { ProjectRow } from "./project-tree/ProjectRow";
import { ThreadRow } from "./project-tree/ThreadRow";
import { useProjectMenuDismiss } from "./project-tree/useProjectMenuDismiss";

type ProjectThreadsGroupProps = {
  isExpanded: boolean;
  threadGroupId: string;
  projectName: string;
  children: ReactNode;
};

function ProjectThreadsGroup({
  isExpanded,
  threadGroupId,
  projectName,
  children,
}: ProjectThreadsGroupProps) {
  const present = useAnimatedPresence(isExpanded);

  if (!present) {
    return null;
  }

  return (
    <div
      id={threadGroupId}
      aria-label={`Threads in ${projectName}`}
      data-open={isExpanded ? "true" : "false"}
      className="motion-collapse-panel mt-0.5"
    >
      <div className="motion-collapse-panel__inner">{children}</div>
    </div>
  );
}

type NewSessionButtonProps = {
  projectName: string;
  onClick: () => void;
};

function NewSessionButton({ projectName, onClick }: NewSessionButtonProps) {
  return (
    <button
      type="button"
      className="group/new-session grid min-h-8 w-full grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-xl px-2 py-0.5 text-left text-[12.5px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] focus-visible:bg-[rgba(255,255,255,0.04)] focus-visible:text-[color:var(--text)]"
      onClick={onClick}
      aria-label={`Start a new session in ${projectName}`}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover/new-session:text-[color:var(--text)] group-focus-visible/new-session:text-[color:var(--text)]">
        <Plus size={12} />
      </span>
      <span>New session</span>
    </button>
  );
}

type ProjectTreeProps = {
  projects: Project[];
  selectedProjectId: string;
  selectedThreadId: string | null;
  activeView: View;
  selectionModeActive: boolean;
  collapsedProjectIds: Record<string, boolean>;
  onAction: DesktopActionInvoker;
  onProjectSelect: (projectId: string) => void;
  onProjectReorder: (projectIds: string[]) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

type SortableProjectItemProps = {
  projectId: string;
  disabled?: boolean;
  children: (input: {
    dragHandleProps?: {
      attributes: DraggableAttributes;
      listeners: DraggableSyntheticListeners | undefined;
    };
    isDragging: boolean;
  }) => ReactNode;
};

function SortableProjectItem({ projectId, disabled = false, children }: SortableProjectItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: projectId,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={isDragging ? "z-20 opacity-80" : undefined}
    >
      {children({
        dragHandleProps: disabled ? undefined : { attributes, listeners },
        isDragging,
      })}
    </div>
  );
}

export function ProjectTree({
  projects,
  selectedProjectId,
  selectedThreadId,
  activeView,
  selectionModeActive,
  collapsedProjectIds,
  onAction,
  onProjectSelect,
  onProjectReorder,
  onThreadOpen,
  onToggleProjectCollapse,
}: ProjectTreeProps) {
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const { containerRef } = useProjectMenuDismiss(openProjectMenuId !== null, () =>
    setOpenProjectMenuId(null),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingProjectId(typeof event.active.id === "string" ? event.active.id : null);
    setOpenProjectMenuId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingProjectId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = projects.findIndex((project) => project.id === active.id);
    const newIndex = projects.findIndex((project) => project.id === over.id);

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return;
    }

    const nextProjects = arrayMove(projects, oldIndex, newIndex);
    onProjectReorder(nextProjects.map((project) => project.id));
  };

  const handleStartEdit = (projectId: string, projectName: string) => {
    setOpenProjectMenuId(null);
    setEditingProjectId(projectId);
    setRenameDraft(projectName);
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setRenameDraft("");
  };

  const handleSubmitEdit = (projectId: string) => {
    const nextProjectName = renameDraft.trim();
    if (!nextProjectName) {
      handleCancelEdit();
      return;
    }

    void onAction("project.edit-name", {
      projectId,
      projectName: nextProjectName,
    });
    setEditingProjectId(null);
    setRenameDraft("");
  };

  return (
    <div ref={containerRef} className="min-h-0 overflow-auto pr-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggingProjectId(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
          {projects.map((project) => {
            const isExpanded = !collapsedProjectIds[project.id];
            const effectiveIsExpanded = isExpanded && draggingProjectId !== project.id;
            const hasThreads = project.threadsLoaded
              ? project.threads.length > 0
              : (project.threadCount ?? 0) > 0;
            const projectMenuOpen = openProjectMenuId === project.id;
            const threadGroupId = `project-threads-${project.id}`;
            const actionMenuId = `project-actions-${project.id}`;

            return (
              <SortableProjectItem
                key={project.id}
                projectId={project.id}
                disabled={selectionModeActive}
              >
                {({ dragHandleProps, isDragging }) => (
                  <div className="mb-2">
                    <div className="relative">
                      <ProjectRow
                        actionMenuId={actionMenuId}
                        actionMenuOpen={projectMenuOpen}
                        dragHandleProps={dragHandleProps}
                        isActive={selectionModeActive && selectedProjectId === project.id}
                        isDragging={isDragging}
                        isEditing={editingProjectId === project.id}
                        isExpanded={effectiveIsExpanded}
                        hasRepoOrigin={Boolean(project.repoOriginUrl)}
                        canEdit={!selectionModeActive}
                        canToggleExpanded={!selectionModeActive}
                        name={project.name}
                        renameDraft={renameDraft}
                        showActions={!selectionModeActive}
                        threadGroupId={threadGroupId}
                        onCancelEdit={handleCancelEdit}
                        onChangeRenameDraft={setRenameDraft}
                        onEdit={() => handleStartEdit(project.id, project.name)}
                        onSelect={() => {
                          onProjectSelect(project.id);
                          if (activeView !== "extensions" && activeView !== "skills") {
                            onAction("project.select", { projectId: project.id });
                          }
                          setOpenProjectMenuId(null);
                        }}
                        onSubmitEdit={() => handleSubmitEdit(project.id)}
                        onToggleActions={() =>
                          setOpenProjectMenuId((current) =>
                            current === project.id ? null : project.id,
                          )
                        }
                        onToggleExpanded={() => onToggleProjectCollapse(project.id)}
                      />

                      {projectMenuOpen &&
                      editingProjectId !== project.id &&
                      !selectionModeActive ? (
                        <ProjectActionMenu
                          menuId={actionMenuId}
                          projectId={project.id}
                          projectName={project.name}
                          pinned={Boolean(project.pinned)}
                          onAction={onAction}
                          onClose={() => setOpenProjectMenuId(null)}
                        />
                      ) : null}
                    </div>

                    {selectionModeActive ? null : (
                      <ProjectThreadsGroup
                        isExpanded={effectiveIsExpanded}
                        threadGroupId={threadGroupId}
                        projectName={project.name}
                      >
                        <NewSessionButton
                          projectName={project.name}
                          onClick={() => {
                            onProjectSelect(project.id);
                            void onAction("thread.new", { projectId: project.id });
                            setOpenProjectMenuId(null);
                          }}
                        />

                        {hasThreads ? (
                          project.threads.map((thread) => {
                            const isSelected =
                              selectedThreadId === thread.id &&
                              (activeView === "thread" || activeView === "gitops");

                            return (
                              <ThreadRow
                                key={thread.id}
                                age={thread.age}
                                pinned={Boolean(thread.pinned)}
                                running={Boolean(thread.running)}
                                unread={Boolean(thread.unread)}
                                isSelected={isSelected}
                                title={thread.title}
                                onArchive={() =>
                                  onAction("thread.archive", {
                                    projectId: project.id,
                                    threadId: thread.id,
                                  })
                                }
                                onOpen={() => {
                                  if (!thread.sessionPath) {
                                    return;
                                  }

                                  onThreadOpen(project.id, thread.id, thread.sessionPath);
                                  setOpenProjectMenuId(null);
                                }}
                                onPin={() =>
                                  onAction("thread.pin", {
                                    projectId: project.id,
                                    threadId: thread.id,
                                  })
                                }
                              />
                            );
                          })
                        ) : project.threadsLoaded || (project.threadCount ?? 0) === 0 ? (
                          <EmptyThreadsState />
                        ) : null}
                      </ProjectThreadsGroup>
                    )}
                  </div>
                )}
              </SortableProjectItem>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}
