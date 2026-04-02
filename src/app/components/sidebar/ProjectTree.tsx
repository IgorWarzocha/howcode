import { type ReactNode, useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
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
                onAction("project.edit-name", {
                  projectId: project.id,
                  projectName: project.name,
                })
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
                projectName={project.name}
                onAction={onAction}
                onClose={() => setOpenProjectMenuId(null)}
              />
            ) : null}

            <ProjectThreadsGroup
              isExpanded={isExpanded}
              threadGroupId={threadGroupId}
              projectName={project.name}
            >
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
            </ProjectThreadsGroup>
          </div>
        );
      })}
    </div>
  );
}
