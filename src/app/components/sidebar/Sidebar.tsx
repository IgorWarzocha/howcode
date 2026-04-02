import {
  ArrowLeft,
  ArrowRight,
  ChevronsUpDown,
  Clock3,
  FolderPlus,
  LayoutGrid,
  ListFilter,
  PanelLeft,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useCallback, useRef } from "react";
import type { DesktopAction } from "../../desktop/actions";
import { getFeatureStatusButtonClass } from "../../features/feature-status";
import { useAnimatedPresence } from "../../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import type { Project, View } from "../../types";
import { iconButtonClass, sidebarSectionLabelClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { IconButton } from "../common/IconButton";
import { NavButton } from "../common/NavButton";
import { ProjectTree } from "./ProjectTree";
import { SettingsMenu } from "./SettingsMenu";

type SidebarProps = {
  projects: Project[];
  activeView: View;
  selectedProjectId: string;
  selectedThreadId: string | null;
  sidebarVisible: boolean;
  settingsOpen: boolean;
  collapsedProjectIds: Record<string, boolean>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onShowView: (view: View) => void;
  onToggleSidebar: () => void;
  onToggleSettings: () => void;
  onOpenArchivedThreads: () => void;
  onCollapseAll: () => void;
  onProjectSelect: (projectId: string) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

export function Sidebar({
  projects,
  activeView,
  selectedProjectId,
  selectedThreadId,
  sidebarVisible,
  settingsOpen,
  collapsedProjectIds,
  onAction,
  onShowView,
  onToggleSidebar,
  onToggleSettings,
  onOpenArchivedThreads,
  onCollapseAll,
  onProjectSelect,
  onThreadOpen,
  onToggleProjectCollapse,
}: SidebarProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const threadsHeadingId = "sidebar-threads-heading";
  const settingsMenuId = "sidebar-settings-menu";
  const settingsMenuPresent = useAnimatedPresence(settingsOpen);
  const closeSettings = useCallback(() => {
    if (settingsOpen) {
      onToggleSettings();
    }
  }, [onToggleSettings, settingsOpen]);

  useDismissibleLayer({
    open: settingsOpen,
    onDismiss: closeSettings,
    refs: [settingsButtonRef, settingsMenuRef],
  });

  return (
    <>
      {sidebarVisible ? (
        <aside
          aria-label="Workspace sidebar"
          className="relative flex min-h-0 min-w-0 flex-col gap-3.5 overflow-hidden border-r border-[color:var(--border)] bg-[color:var(--sidebar)] px-2.5 pt-3 pb-2.5"
        >
          <div className="flex items-center gap-1.5">
            <IconButton
              label="Hide sidebar"
              onClick={onToggleSidebar}
              icon={<PanelLeft size={15} />}
            />
            <IconButton
              label="Back"
              onClick={() => onAction("nav.back")}
              icon={<ArrowLeft size={16} />}
            />
            <IconButton
              label="Forward"
              onClick={() => onAction("nav.forward")}
              icon={<ArrowRight size={16} />}
            />
          </div>

          <nav className="grid gap-0.5" aria-label="Primary navigation">
            <NavButton
              icon={<Sparkles size={16} />}
              label="New thread"
              active={activeView === "home"}
              onClick={() => {
                onShowView("home");
                onAction("thread.new", {
                  projectId: (selectedProjectId || projects[0]?.id) ?? null,
                });
              }}
            />
            <NavButton
              icon={<LayoutGrid size={16} />}
              label={
                <span className="inline-flex items-center gap-2">
                  <span>Plugins</span>
                  <FeatureStatusBadge statusId="feature:sidebar.plugins" />
                </span>
              }
              active={activeView === "plugins"}
              onClick={() => onShowView("plugins")}
            />
            <NavButton
              icon={<Workflow size={16} />}
              label={
                <span className="inline-flex items-center gap-2">
                  <span>Automations</span>
                  <FeatureStatusBadge statusId="feature:sidebar.automations" />
                </span>
              }
              active={activeView === "automations"}
              onClick={() => onShowView("automations")}
            />
            <NavButton
              icon={<Clock3 size={16} />}
              label={
                <span className="inline-flex items-center gap-2">
                  <span>Debug</span>
                  <FeatureStatusBadge statusId="feature:sidebar.debug" />
                </span>
              }
              active={activeView === "debug"}
              onClick={() => onShowView("debug")}
            />
          </nav>

          <section
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden"
            aria-labelledby={threadsHeadingId}
          >
            <div className={sidebarSectionLabelClass}>
              <span id={threadsHeadingId}>Threads</span>
              <div className="flex items-center gap-1.5">
                <IconButton
                  label="Collapse all"
                  onClick={onCollapseAll}
                  icon={<ChevronsUpDown size={15} />}
                />
                <IconButton
                  label="Filter sidebar threads"
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
            </div>

            <ProjectTree
              projects={projects}
              selectedProjectId={selectedProjectId}
              selectedThreadId={selectedThreadId}
              activeView={activeView}
              collapsedProjectIds={collapsedProjectIds}
              onAction={onAction}
              onProjectSelect={onProjectSelect}
              onThreadOpen={onThreadOpen}
              onToggleProjectCollapse={onToggleProjectCollapse}
            />
          </section>

          <button
            ref={settingsButtonRef}
            type="button"
            className={cn(
              "mt-auto flex min-h-[34px] w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 text-[14px] text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
              settingsOpen && "bg-[rgba(183,186,245,0.08)] text-[color:var(--text)]",
            )}
            onClick={onToggleSettings}
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-controls={settingsMenuId}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          {settingsMenuPresent ? (
            <SettingsMenu
              menuId={settingsMenuId}
              open={settingsOpen}
              panelRef={settingsMenuRef}
              onOpenArchivedThreads={onOpenArchivedThreads}
            />
          ) : null}
        </aside>
      ) : null}

      {!sidebarVisible ? (
        <button
          type="button"
          className={cn(
            "fixed top-3 left-2.5 z-20 border-[color:var(--border)] bg-[rgba(35,38,51,0.95)] shadow-[0_10px_30px_rgba(0,0,0,0.22)]",
            iconButtonClass,
          )}
          onClick={onToggleSidebar}
          aria-label="Show sidebar"
        >
          <PanelLeft size={16} />
        </button>
      ) : null}
    </>
  );
}
