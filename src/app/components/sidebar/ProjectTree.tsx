import { Archive, ChevronDown, ChevronRight, Folder, Pin } from "lucide-react";
import type { DesktopAction } from "../../desktop/actions";
import type { Project, View } from "../../types";
import { cn } from "../../utils/cn";
import { IconButton } from "../common/IconButton";

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
  return (
    <div className="min-h-0 overflow-auto pr-1">
      {projects.map((project) => {
        const isExpanded = !collapsedProjectIds[project.id];
        const hasThreads = project.threads.length > 0;

        return (
          <div key={project.id} className="mb-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
              <button
                type="button"
                className={cn(
                  "flex min-h-8 w-full items-center gap-2 rounded-lg border border-transparent px-2 text-left text-[14px] text-[color:var(--muted)] transition-colors duration-150 ease-out hover:text-[color:var(--text)]",
                  selectedProjectId === project.id && "text-[color:var(--text)]",
                )}
                onClick={() => {
                  onProjectSelect(project.id);
                  onAction("project.select", { projectId: project.id });
                }}
                aria-label={project.name}
              >
                <Folder size={14} />
                <span className="truncate font-medium text-[color:var(--text)]/92">
                  {project.name}
                </span>
                {project.subtitle ? (
                  <span className="truncate text-[13px] text-[color:var(--muted-2)]">
                    {project.subtitle}
                  </span>
                ) : null}
              </button>
              <div className="flex items-center gap-1">
                <IconButton
                  label={isExpanded ? "Collapse folder" : "Expand folder"}
                  onClick={() => {
                    onToggleProjectCollapse(project.id);
                    onAction(isExpanded ? "project.collapse" : "project.expand", {
                      projectId: project.id,
                    });
                  }}
                  icon={isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                />
              </div>
            </div>

            {isExpanded ? (
              <div className="mt-1 pl-6" aria-label={`Threads in ${project.name}`}>
                {hasThreads ? (
                  project.threads.map((thread) => {
                    const isSelected = selectedThreadId === thread.id && activeView === "thread";

                    return (
                      <div
                        key={thread.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1"
                      >
                        <button
                          type="button"
                          className={cn(
                            "flex min-h-[30px] w-full items-center justify-between gap-2 rounded-[10px] border border-transparent px-2.5 text-left text-[13px] text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
                            isSelected &&
                              "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.04)]",
                          )}
                          onClick={() => onThreadOpen(project.id, thread.id)}
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate">
                            {thread.pinned ? (
                              <Pin size={12} className="shrink-0 text-[color:var(--muted)]" />
                            ) : null}
                            <span className="truncate">{thread.title}</span>
                          </span>
                          <span className="shrink-0 text-[color:var(--muted-2)]">{thread.age}</span>
                        </button>
                        {isSelected ? (
                          <IconButton
                            label="Archive thread"
                            onClick={() => onAction("thread.archive", { threadId: thread.id })}
                            icon={<Archive size={13} />}
                          />
                        ) : null}
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
