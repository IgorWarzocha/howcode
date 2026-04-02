import { useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type { Project, View } from "../../types";
import { ProjectActionMenu } from "./ProjectActionMenu";
import { EmptyThreadsState } from "./project-tree/EmptyThreadsState";
import { ProjectRow } from "./project-tree/ProjectRow";
import { ThreadRow } from "./project-tree/ThreadRow";
import { useProjectMenuDismiss } from "./project-tree/useProjectMenuDismiss";

type ProjectTreeProps = {
  projects: Project[];
  selectedProjectId: string;
  selectedThreadId: string | null;
  activeView: View;
  collapsedProjectIds: Record<string, boolean>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onProjectSelect: (projectId: string) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
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
  const { containerRef } = useProjectMenuDismiss(openProjectMenuId !== null, () =>
    setOpenProjectMenuId(null),
  );

  return (
    <div ref={containerRef} className="min-h-0 overflow-auto pr-1">
      {projects.map((project) => {
        const isExpanded = !collapsedProjectIds[project.id];
        const hasThreads = project.threadsLoaded
          ? project.threads.length > 0
          : (project.threadCount ?? 0) > 0;
        const projectIsActive = selectedProjectId === project.id;
        const projectMenuOpen = openProjectMenuId === project.id;
        const threadGroupId = `project-threads-${project.id}`;
        const actionMenuId = `project-actions-${project.id}`;

        return (
          <div key={project.id} className="relative mb-2">
            <ProjectRow
              actionMenuId={actionMenuId}
              actionMenuOpen={projectMenuOpen}
              isActive={projectIsActive}
              isExpanded={isExpanded}
              name={project.name}
              threadGroupId={threadGroupId}
              onEdit={() =>
                onAction("project.actions", { projectId: project.id, menuAction: "edit-name" })
              }
              onSelect={() => {
                onProjectSelect(project.id);
                onAction("project.select", { projectId: project.id });
                setOpenProjectMenuId(null);
              }}
              onToggleActions={() =>
                setOpenProjectMenuId((current) => (current === project.id ? null : project.id))
              }
              onToggleExpanded={() => onToggleProjectCollapse(project.id)}
            />

            {projectMenuOpen ? (
              <ProjectActionMenu
                menuId={actionMenuId}
                projectId={project.id}
                onAction={onAction}
                onClose={() => setOpenProjectMenuId(null)}
              />
            ) : null}

            {isExpanded ? (
              <div id={threadGroupId} className="mt-0.5" aria-label={`Threads in ${project.name}`}>
                {hasThreads ? (
                  project.threads.map((thread) => {
                    const isSelected = selectedThreadId === thread.id && activeView === "thread";

                    return (
                      <ThreadRow
                        key={thread.id}
                        age={thread.age}
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
                          onAction("thread.pin", { projectId: project.id, threadId: thread.id })
                        }
                      />
                    );
                  })
                ) : project.threadsLoaded || (project.threadCount ?? 0) === 0 ? (
                  <EmptyThreadsState />
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
