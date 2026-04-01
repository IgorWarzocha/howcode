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
import type { DesktopAction } from "../../desktop/actions";
import type { Project, View } from "../../types";
import { sidebarSectionLabelClass } from "../../ui/classes";
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
  onCollapseAll: () => void;
  onProjectSelect: (projectId: string) => void;
  onThreadOpen: (projectId: string, threadId: string) => void;
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
  onCollapseAll,
  onProjectSelect,
  onThreadOpen,
  onToggleProjectCollapse,
}: SidebarProps) {
  return (
    <>
      <aside
        className={
          sidebarVisible
            ? "relative flex flex-col gap-3.5 overflow-hidden border-r border-[color:var(--border)] bg-[rgba(32,35,46,0.88)] px-2.5 pt-3.5 pb-2.5"
            : "hidden"
        }
      >
        <div className="flex items-center gap-1.5">
          <IconButton
            label="Hide sidebar"
            onClick={onToggleSidebar}
            icon={<PanelLeft size={16} />}
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

        <nav className="grid gap-1">
          <NavButton
            icon={<Sparkles size={16} />}
            label="New thread"
            active={activeView === "home"}
            onClick={() => onShowView("home")}
          />
          <NavButton
            icon={<LayoutGrid size={16} />}
            label="Plugins"
            active={activeView === "plugins"}
            onClick={() => onShowView("plugins")}
          />
          <NavButton
            icon={<Workflow size={16} />}
            label="Automations"
            active={activeView === "automations"}
            onClick={() => onShowView("automations")}
          />
          <NavButton
            icon={<Clock3 size={16} />}
            label="Debug"
            active={activeView === "debug"}
            onClick={() => onShowView("debug")}
          />
        </nav>

        <section className="flex min-h-0 flex-col gap-2.5">
          <div className={sidebarSectionLabelClass}>
            <span>Threads</span>
            <div className="flex items-center gap-1.5">
              <IconButton
                label="Collapse all"
                onClick={() => {
                  onCollapseAll();
                  onAction("threads.collapse-all");
                }}
                icon={<ChevronsUpDown size={15} />}
              />
              <IconButton
                label="Filter sidebar threads"
                onClick={() => onAction("threads.filter")}
                icon={<ListFilter size={15} />}
              />
              <IconButton
                label="Add new project"
                onClick={() => onAction("project.add")}
                icon={<FolderPlus size={15} />}
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
          type="button"
          className="mt-auto flex min-h-[34px] w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[var(--surface-hover)] hover:text-[color:var(--text)]"
          onClick={onToggleSettings}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>

        {settingsOpen ? <SettingsMenu /> : null}
      </aside>

      {!sidebarVisible ? (
        <button
          type="button"
          className="fixed top-4 left-4 z-20 inline-flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-[color:var(--border-strong)] bg-[rgba(35,38,51,0.95)]"
          onClick={onToggleSidebar}
          aria-label="Show sidebar"
        >
          <PanelLeft size={16} />
        </button>
      ) : null}
    </>
  );
}
