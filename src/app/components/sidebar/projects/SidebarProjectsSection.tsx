import { FolderPlus, Github, ListFilter, Search, Star } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { AppSettings, DesktopActionInvoker } from "../../../desktop/types";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import type { Project, View } from "../../../types";
import { sidebarSearchFieldClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { IconButton } from "../../common/IconButton";
import { ProjectTree } from "../ProjectTree";
import { SidebarProjectsCreatePopover } from "./SidebarProjectsCreatePopover";
import { SidebarProjectsPlaceholder } from "./SidebarProjectsPlaceholder";
import {
  type SidebarProjectsFilterMode,
  getSidebarVisibleProjects,
} from "./sidebar-projects.helpers";

type SidebarProjectsSectionProps = {
  activeView: View;
  appSettings: AppSettings;
  projectScopeLockActive: boolean;
  projects: Project[];
  selectedProjectId: string;
  selectedThreadId: string | null;
  collapsedProjectIds: Record<string, boolean>;
  onAction: DesktopActionInvoker;
  onOpenSettingsPanel: () => void;
  onProjectSelect: (projectId: string) => void;
  onProjectReorder: (projectIds: string[]) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

export function SidebarProjectsSection({
  activeView,
  appSettings,
  projectScopeLockActive,
  projects,
  selectedProjectId,
  selectedThreadId,
  collapsedProjectIds,
  onAction,
  onOpenSettingsPanel,
  onProjectSelect,
  onProjectReorder,
  onThreadOpen,
  onToggleProjectCollapse,
}: SidebarProjectsSectionProps) {
  const showProjects =
    activeView === "code" ||
    activeView === "thread" ||
    activeView === "settings" ||
    activeView === "extensions" ||
    activeView === "skills";
  const selectionModeActive =
    (activeView === "extensions" || activeView === "skills") && projectScopeLockActive;
  const showProjectCreate = activeView !== "extensions" && activeView !== "skills";
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<SidebarProjectsFilterMode>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const createPanelRef = useRef<HTMLDialogElement>(null);

  const { projects: visibleProjects, autoExpandedProjectIds } = useMemo(
    () =>
      getSidebarVisibleProjects({
        projects,
        searchQuery,
        filterMode,
      }),
    [filterMode, projects, searchQuery],
  );

  const effectiveCollapsedProjectIds = useMemo(() => {
    if (searchQuery.trim().length === 0) {
      return collapsedProjectIds;
    }

    return {
      ...collapsedProjectIds,
      ...Object.fromEntries([...autoExpandedProjectIds].map((projectId) => [projectId, false])),
    };
  }, [autoExpandedProjectIds, collapsedProjectIds, searchQuery]);

  const cycleFilterMode = () => {
    setFilterMode((current) => {
      if (current === "all") {
        return "favourites";
      }

      if (current === "favourites") {
        return "github";
      }

      return "all";
    });
  };

  const dismissCreate = useCallback(() => {
    setCreateOpen(false);
  }, []);

  useDismissibleLayer({
    open: createOpen,
    onDismiss: dismissCreate,
    refs: [createButtonRef, createPanelRef],
  });

  const handleCreateProject = async () => {
    if (createBusy) {
      return;
    }

    setCreateErrorMessage(null);

    if (!appSettings.preferredProjectLocation) {
      setCreateOpen(false);
      onOpenSettingsPanel();
      return;
    }

    const projectName = projectNameDraft.trim();
    if (!projectName) {
      return;
    }

    setCreateBusy(true);

    try {
      const result = await onAction("project.add", { projectName });
      const error = typeof result?.result?.error === "string" ? result.result.error : null;

      if (error) {
        setCreateErrorMessage(error);
        return;
      }

      setProjectNameDraft("");
      setCreateOpen(false);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
        <label
          className={cn(
            sidebarSearchFieldClass,
            searchQuery.trim().length > 0 && "bg-[rgba(255,255,255,0.05)] text-[color:var(--text)]",
          )}
        >
          <Search size={14} className="shrink-0 text-[color:var(--muted)]" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            className="w-full min-w-0 bg-transparent p-0 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
            aria-label="Search projects"
          />
        </label>
        {showProjects ? (
          <div className="relative flex items-center gap-1.5">
            <IconButton
              label="Filter projects"
              onClick={cycleFilterMode}
              icon={
                filterMode === "favourites" ? (
                  <Star size={15} className="fill-current" />
                ) : filterMode === "github" ? (
                  <Github size={15} />
                ) : (
                  <ListFilter size={15} />
                )
              }
              active={filterMode !== "all"}
            />
            {showProjectCreate ? (
              <IconButton
                ref={createButtonRef}
                label="Add new project"
                onClick={() => {
                  if (!appSettings.preferredProjectLocation) {
                    onOpenSettingsPanel();
                    return;
                  }

                  setCreateErrorMessage(null);
                  setCreateOpen(true);
                }}
                icon={<FolderPlus size={15} />}
              />
            ) : null}
          </div>
        ) : null}

        {createOpen ? (
          <SidebarProjectsCreatePopover
            menuId="sidebar-project-create-dialog"
            open={createOpen}
            draft={projectNameDraft}
            defaultLocation={appSettings.preferredProjectLocation}
            initializeGit={appSettings.initializeGitOnProjectCreate}
            busy={createBusy}
            errorMessage={createErrorMessage}
            panelRef={createPanelRef}
            onChangeDraft={setProjectNameDraft}
            onCreate={() => {
              void handleCreateProject();
            }}
            onClose={() => {
              setCreateOpen(false);
              setCreateErrorMessage(null);
            }}
            onOpenSettings={() => {
              setCreateOpen(false);
              onOpenSettingsPanel();
            }}
          />
        ) : null}
      </div>

      {showProjects ? (
        visibleProjects.length > 0 ? (
          <ProjectTree
            projects={visibleProjects}
            selectedProjectId={selectedProjectId}
            selectedThreadId={selectedThreadId}
            activeView={activeView}
            selectionModeActive={selectionModeActive}
            collapsedProjectIds={effectiveCollapsedProjectIds}
            onAction={onAction}
            onProjectSelect={onProjectSelect}
            onProjectReorder={onProjectReorder}
            onThreadOpen={onThreadOpen}
            onToggleProjectCollapse={onToggleProjectCollapse}
          />
        ) : (
          <div
            className={cn(
              "px-2.5 py-2 text-[13px] text-[color:var(--muted-2)]",
              searchQuery.trim().length > 0 || filterMode !== "all" ? "" : "hidden",
            )}
          >
            No matching projects
          </div>
        )
      ) : (
        <SidebarProjectsPlaceholder />
      )}
    </section>
  );
}
