import {
  ChevronDown,
  ChevronRight,
  Folder,
  MoreHorizontal,
  Package,
  Pin,
  Plus,
} from "lucide-react";
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
          <div key={project.id} className="mb-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
              <button
                type="button"
                className={cn(
                  "flex min-h-8 w-full items-center gap-2 rounded-xl border border-transparent px-2.5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[var(--surface-hover)] hover:text-[color:var(--text)]",
                  selectedProjectId === project.id &&
                    "bg-[var(--accent-soft)] text-[color:var(--text)]",
                )}
                onClick={() => {
                  onProjectSelect(project.id);
                  onAction("project.select", { projectId: project.id });
                }}
                aria-label={project.name}
              >
                <Folder size={14} />
                <span className="truncate">{project.name}</span>
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
                <IconButton
                  label={`Project actions for ${project.name}`}
                  onClick={() => onAction("project.actions", { projectId: project.id })}
                  icon={<MoreHorizontal size={14} />}
                />
                <IconButton
                  label={`Start new thread in ${project.name}`}
                  onClick={() => onAction("thread.new", { projectId: project.id })}
                  icon={<Plus size={14} />}
                />
              </div>
            </div>

            {isExpanded ? (
              <div className="mt-1 pl-3.5" aria-label={`Automations in ${project.name}`}>
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
                            "flex min-h-[34px] w-full items-center justify-between gap-2 rounded-xl border border-transparent px-2.5 text-left text-[13px] text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[var(--surface-hover)] hover:text-[color:var(--text)]",
                            isSelected && "bg-[var(--accent-soft)] text-[color:var(--text)]",
                          )}
                          onClick={() => onThreadOpen(project.id, thread.id)}
                        >
                          <span className="truncate">{thread.title}</span>
                          <span className="shrink-0">{thread.age}</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <IconButton
                            label="Archive thread"
                            onClick={() => onAction("thread.archive", { threadId: thread.id })}
                            icon={<Package size={13} />}
                          />
                          <IconButton
                            label="Pin thread"
                            onClick={() => onAction("thread.pin", { threadId: thread.id })}
                            icon={<Pin size={13} />}
                          />
                        </div>
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
