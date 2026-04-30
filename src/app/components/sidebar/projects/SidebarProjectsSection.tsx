import { Clock3, FolderPlus, Github, ListFilter, Search, SquareTerminal, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseGitHubRepositoryUrl } from "../../../../../shared/github-repository-url";
import type { AppSettings, DesktopActionInvoker } from "../../../desktop/types";
import { useDesktopBridgeAvailable } from "../../../hooks/useDesktopBridge";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import type { Project, View } from "../../../types";
import { cn } from "../../../utils/cn";
import { IconButton } from "../../common/IconButton";
import { ProjectTree } from "../ProjectTree";
import { SidebarProjectsCreatePopover } from "./SidebarProjectsCreatePopover";
import {
  type SidebarProjectsFilterMode,
  getSidebarVisibleProjects,
} from "./sidebar-projects.helpers";

type PendingProject = {
  key: string;
  name: string;
};

type SidebarProjectsSectionProps = {
  activeView: View;
  appLaunchedAtMs: number;
  appSettings: AppSettings;
  protectedProjectId?: string | null;
  projectScopeLockActive: boolean;
  projects: Project[];
  selectedProjectId: string;
  selectedThreadId: string | null;
  terminalRunningProjectIds: ReadonlySet<string>;
  terminalRunningSessionPaths: ReadonlySet<string>;
  collapsedProjectIds: Record<string, boolean>;
  onAction: DesktopActionInvoker;
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>;
  onOpenSettingsPanel: () => void;
  onProjectSelect: (projectId: string) => void;
  onProjectReorder: (projectIds: string[]) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

export function SidebarProjectsSection({
  activeView,
  appLaunchedAtMs,
  appSettings,
  protectedProjectId = null,
  projectScopeLockActive,
  projects,
  selectedProjectId,
  selectedThreadId,
  terminalRunningProjectIds,
  terminalRunningSessionPaths,
  collapsedProjectIds,
  onAction,
  onLoadProjectThreads,
  onOpenSettingsPanel,
  onProjectSelect,
  onProjectReorder,
  onThreadOpen,
  onToggleProjectCollapse,
}: SidebarProjectsSectionProps) {
  const showProjects =
    activeView === "chat" ||
    activeView === "code" ||
    activeView === "thread" ||
    activeView === "gitops" ||
    activeView === "archived" ||
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
  const [createdProjectIds, setCreatedProjectIds] = useState<string[]>([]);
  const [pendingProject, setPendingProject] = useState<PendingProject | null>(null);
  const desktopBridgeAvailable = useDesktopBridgeAvailable();
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const createPanelRef = useRef<HTMLDialogElement>(null);

  const { projects: visibleProjects, autoExpandedProjectIds } = useMemo(
    () =>
      getSidebarVisibleProjects({
        projects,
        searchQuery,
        filterMode,
        terminalRunningProjectIds,
        terminalRunningSessionPaths,
        appLaunchedAtMs,
        priorityProjectIds: createdProjectIds,
      }),
    [
      appLaunchedAtMs,
      createdProjectIds,
      filterMode,
      projects,
      searchQuery,
      terminalRunningProjectIds,
      terminalRunningSessionPaths,
    ],
  );

  useEffect(() => {
    if (filterMode !== "terminal" && filterMode !== "recent" && searchQuery.trim().length === 0) {
      return;
    }

    for (const project of visibleProjects) {
      const sourceProject = projects.find((candidate) => candidate.id === project.id);

      const shouldLoadSearchedProject = searchQuery.trim().length > 0;
      const hasIndexedThreads = (sourceProject?.threadCount ?? project.threadCount ?? 0) > 0;

      const threadsScope = activeView === "chat" ? "chat" : "code";
      if (
        (project.threadsLoaded && project.threadsScope === threadsScope) ||
        (!shouldLoadSearchedProject && !hasIndexedThreads)
      ) {
        continue;
      }

      void onLoadProjectThreads(project.id, { chat: activeView === "chat" });
    }
  }, [activeView, filterMode, onLoadProjectThreads, projects, searchQuery, visibleProjects]);

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

      if (current === "github") {
        return "terminal";
      }

      if (current === "terminal") {
        return "recent";
      }

      return "all";
    });
  };

  const filterLabel =
    filterMode === "favourites"
      ? "Show favourites"
      : filterMode === "github"
        ? "Show GitHub projects"
        : filterMode === "terminal"
          ? "Show threads with running terminals"
          : filterMode === "recent"
            ? "Show threads active since launch"
            : "Filter projects";

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

    const draft = projectNameDraft.trim();
    if (!draft) {
      return;
    }

    const repository = parseGitHubRepositoryUrl(draft);
    const pendingProjectName = repository?.folderName ?? draft;
    setPendingProject({ key: `${Date.now()}:${draft}`, name: pendingProjectName });
    setProjectNameDraft("");
    setCreateOpen(false);
    setCreateBusy(true);

    try {
      const result = await onAction(
        "project.add",
        repository ? { repoUrl: repository.canonicalUrl } : { projectName: draft },
      );
      const error = typeof result?.result?.error === "string" ? result.result.error : null;

      if (error) {
        setCreateErrorMessage(error);
        setProjectNameDraft(draft);
        setCreateOpen(true);
        setPendingProject(null);
        return;
      }

      const projectId =
        typeof result?.result?.projectId === "string" ? result.result.projectId : null;
      if (projectId) {
        setCreatedProjectIds((current) => [projectId, ...current.filter((id) => id !== projectId)]);
      }

      setPendingProject(null);
    } catch (error) {
      setCreateErrorMessage(error instanceof Error ? error.message : "Unable to add project.");
      setProjectNameDraft(draft);
      setCreateOpen(true);
      setPendingProject(null);
    } finally {
      setCreateBusy(false);
    }
  };

  if (!showProjects) {
    return <section className="sidebar-section" aria-hidden="true" />;
  }

  return (
    <section className="sidebar-section">
      <div className="sidebar-toolbar">
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
            aria-label="Search projects"
          />
        </label>
        {showProjects ? (
          <div className="sidebar-action-group">
            <IconButton
              label={filterLabel}
              tooltipPlacement="right"
              onClick={cycleFilterMode}
              icon={
                filterMode === "favourites" ? (
                  <Star size={15} className="fill-current" />
                ) : filterMode === "github" ? (
                  <Github size={15} />
                ) : filterMode === "terminal" ? (
                  <SquareTerminal size={15} />
                ) : filterMode === "recent" ? (
                  <Clock3 size={15} />
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
                tooltipPlacement="right"
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
          />
        ) : null}
      </div>

      {visibleProjects.length > 0 || pendingProject ? (
        <>
          {pendingProject ? (
            <div className="sidebar-tree-item" aria-live="polite">
              <div className="sidebar-project-row sidebar-row-surface motion-surface-pulse">
                <span className="sidebar-project-toggle" data-can-toggle="false">
                  <FolderPlus
                    size={12}
                    className="sidebar-project-icon sidebar-project-origin-icon"
                  />
                </span>
                <div
                  className="sidebar-project-button"
                  aria-label={`Adding ${pendingProject.name}`}
                >
                  <span className="sidebar-project-title">{pendingProject.name}</span>
                </div>
                <span className="text-[11px] text-[color:var(--muted-2)]">Adding…</span>
              </div>
            </div>
          ) : null}
          {visibleProjects.length > 0 ? (
            <ProjectTree
              projects={visibleProjects}
              protectedProjectId={protectedProjectId}
              selectedProjectId={selectedProjectId}
              selectedThreadId={selectedThreadId}
              terminalRunningSessionPaths={terminalRunningSessionPaths}
              activeView={activeView}
              selectionModeActive={selectionModeActive}
              revealOldThreads={searchQuery.trim().length > 0}
              collapsedProjectIds={effectiveCollapsedProjectIds}
              onAction={onAction}
              onProjectSelect={onProjectSelect}
              onProjectReorder={onProjectReorder}
              onThreadOpen={onThreadOpen}
              onToggleProjectCollapse={onToggleProjectCollapse}
            />
          ) : null}
        </>
      ) : !desktopBridgeAvailable ? (
        <div className="px-2.5 py-2 text-[12px] leading-5 text-[color:var(--muted-2)]">
          Project sync needs the desktop bridge. Restart the dev server or use{" "}
          <code>bun run dev</code>.
        </div>
      ) : (
        <div
          className={cn(
            "px-2.5 py-2 text-[13px] text-[color:var(--muted-2)]",
            searchQuery.trim().length > 0 || filterMode !== "all" ? "" : "hidden",
          )}
        >
          No matching projects
        </div>
      )}
    </section>
  );
}
