import { ChevronsUpDown, FolderPlus, ListFilter } from "lucide-react";
import type { DesktopAction } from "../../../desktop/actions";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import type { Project, View } from "../../../types";
import { sidebarSectionLabelClass } from "../../../ui/classes";
import { IconButton } from "../../common/IconButton";
import { ProjectTree } from "../ProjectTree";
import { SidebarProjectsPlaceholder } from "./SidebarProjectsPlaceholder";

type SidebarProjectsSectionProps = {
  activeView: View;
  projects: Project[];
  selectedProjectId: string;
  selectedThreadId: string | null;
  collapsedProjectIds: Record<string, boolean>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onCollapseAll: () => void;
  onProjectSelect: (projectId: string) => void;
  onProjectReorder: (projectIds: string[]) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

export function SidebarProjectsSection({
  activeView,
  projects,
  selectedProjectId,
  selectedThreadId,
  collapsedProjectIds,
  onAction,
  onCollapseAll,
  onProjectSelect,
  onProjectReorder,
  onThreadOpen,
  onToggleProjectCollapse,
}: SidebarProjectsSectionProps) {
  const projectsHeadingId = "sidebar-projects-heading";
  const showProjects =
    activeView === "code" || activeView === "thread" || activeView === "settings";

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden"
      aria-labelledby={projectsHeadingId}
    >
      <div className={sidebarSectionLabelClass}>
        <span id={projectsHeadingId}>Projects</span>
        {showProjects ? (
          <div className="flex items-center gap-1.5">
            <IconButton
              label="Collapse all"
              onClick={onCollapseAll}
              icon={<ChevronsUpDown size={15} />}
            />
            <IconButton
              label="Filter projects"
              onClick={() => onAction("threads.filter")}
              icon={<ListFilter size={15} />}
              className={getFeatureStatusButtonClass("feature:sidebar.threads.filter")}
            />
            <IconButton
              label="Add new project"
              onClick={() => onAction("project.add")}
              icon={<FolderPlus size={15} />}
              className={getFeatureStatusButtonClass("feature:sidebar.project.add")}
            />
          </div>
        ) : null}
      </div>

      {showProjects ? (
        <ProjectTree
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedThreadId={selectedThreadId}
          activeView={activeView}
          collapsedProjectIds={collapsedProjectIds}
          onAction={onAction}
          onProjectSelect={onProjectSelect}
          onProjectReorder={onProjectReorder}
          onThreadOpen={onThreadOpen}
          onToggleProjectCollapse={onToggleProjectCollapse}
        />
      ) : (
        <SidebarProjectsPlaceholder />
      )}
    </section>
  );
}
