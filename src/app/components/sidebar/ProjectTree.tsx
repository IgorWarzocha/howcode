import {
  Archive,
  ChevronDown,
  ChevronRight,
  Folder,
  MoreHorizontal,
  Pin,
  SquarePen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type { Project, View } from "../../types";
import { cn } from "../../utils/cn";
import { ProjectActionMenu } from "./ProjectActionMenu";

type ProjectTreeProps = {
  projects: Project[];
  selectedProjectId: string;
  selectedThreadId: string | null;
  activeView: View;
  collapsedProjectIds: Record<string, boolean>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onProjectSelect: (projectId: string) => void;
  onThreadOpen: (projectId: string, threadId: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

export function ProjectTree({
  projects,
  selectedProjectId,
  selectedThreadId,
  activeView,
  collapsedProjectIds,
  onAction,
  onProjectSelect,
  onThreadOpen,
  onToggleProjectCollapse,
}: ProjectTreeProps) {
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenProjectMenuId(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className="min-h-0 overflow-auto pr-1">
      {projects.map((project) => {
        const isExpanded = !collapsedProjectIds[project.id];
        const hasThreads = project.threads.length > 0;
        const projectIsActive = selectedProjectId === project.id;
        const projectMenuOpen = openProjectMenuId === project.id;

        return (
          <div key={project.id} className="relative mb-2">
            <div
              className={cn(
                "group grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] px-2 py-0.5 transition-colors duration-150 ease-out hover:bg-[rgba(183,186,245,0.08)]",
                (projectIsActive || projectMenuOpen) && "bg-[rgba(183,186,245,0.08)]",
              )}
            >
              <button
                type="button"
                className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:text-[color:var(--text)]"
                onClick={() => {
                  onToggleProjectCollapse(project.id);
                  onAction(isExpanded ? "project.collapse" : "project.expand", {
                    projectId: project.id,
                  });
                }}
                aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
              >
                <Folder
                  size={14}
                  className="absolute transition-opacity duration-150 ease-out group-hover:opacity-0"
                />
                {isExpanded ? (
                  <ChevronDown
                    size={14}
                    className="absolute opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
                  />
                ) : (
                  <ChevronRight
                    size={14}
                    className="absolute opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
                  />
                )}
              </button>

              <button
                type="button"
                className={cn(
                  "flex min-h-[32px] min-w-0 items-center rounded-[10px] py-1.5 text-left text-[13px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:text-[color:var(--text)]",
                  projectIsActive && "text-[color:var(--text)]",
                )}
                onClick={() => {
                  onProjectSelect(project.id);
                  onAction("project.select", { projectId: project.id });
                  setOpenProjectMenuId(null);
                }}
                aria-label={project.name}
              >
                <span className="truncate font-medium text-[13.5px] text-[color:var(--text)]/92">
                  {project.name}
                </span>
              </button>

              <div
                className={cn(
                  "flex shrink-0 items-center gap-0.5 pr-0.5 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100",
                  projectMenuOpen && "opacity-100",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.05)] hover:text-[color:var(--text)]",
                    projectMenuOpen && "bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
                  )}
                  onClick={() =>
                    setOpenProjectMenuId((current) => (current === project.id ? null : project.id))
                  }
                  aria-label="Project actions"
                >
                  <MoreHorizontal size={14} />
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.05)] hover:text-[color:var(--text)]"
                  onClick={() =>
                    onAction("project.actions", { projectId: project.id, menuAction: "edit-name" })
                  }
                  aria-label="Edit project"
                >
                  <SquarePen size={13} />
                </button>
              </div>
            </div>

            {projectMenuOpen ? (
              <ProjectActionMenu
                projectId={project.id}
                onAction={onAction}
                onClose={() => setOpenProjectMenuId(null)}
              />
            ) : null}

            {isExpanded ? (
              <div className="mt-0.5" aria-label={`Threads in ${project.name}`}>
                {hasThreads ? (
                  project.threads.map((thread) => {
                    const isSelected = selectedThreadId === thread.id && activeView === "thread";

                    return (
                      <div
                        key={thread.id}
                        className={cn(
                          "group grid min-h-[31px] w-full grid-cols-[16px_minmax(0,1fr)_24px] items-center gap-2 rounded-[10px] px-2 py-0.5 text-[12.5px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
                          isSelected &&
                            "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.04)]",
                        )}
                      >
                        <button
                          type="button"
                          className={cn(
                            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] opacity-0 transition-all duration-150 ease-out hover:text-[color:var(--text)] group-hover:opacity-100",
                            isSelected && "opacity-100",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            onAction("thread.pin", { threadId: thread.id });
                          }}
                          aria-label="Pin thread"
                        >
                          <Pin size={12} />
                        </button>

                        <button
                          type="button"
                          className="flex min-w-0 items-center py-1 text-left"
                          onClick={() => {
                            onThreadOpen(project.id, thread.id);
                            setOpenProjectMenuId(null);
                          }}
                        >
                          <span className="truncate">{thread.title}</span>
                        </button>

                        <span className="relative inline-flex h-4 w-6 shrink-0 items-center justify-center text-[color:var(--muted-2)]">
                          <span
                            className={cn(
                              "absolute transition-opacity duration-150 ease-out group-hover:opacity-0",
                              isSelected && "opacity-0",
                            )}
                          >
                            {thread.age}
                          </span>
                          <button
                            type="button"
                            className={cn(
                              "absolute inline-flex h-4 w-4 items-center justify-center rounded-md text-[color:var(--muted)] opacity-0 transition-all duration-150 ease-out hover:text-[color:var(--text)] group-hover:opacity-100",
                              isSelected && "opacity-100",
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              onAction("thread.archive", { threadId: thread.id });
                            }}
                            aria-label="Archive thread"
                          >
                            <Archive size={12} />
                          </button>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-2 text-[13px] text-[color:var(--muted-2)]">
                    No threads
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
