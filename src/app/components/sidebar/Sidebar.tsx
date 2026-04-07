import { BriefcaseBusiness, Code2, MessageSquare, PawPrint, Settings } from "lucide-react";
import { useCallback, useRef } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type { AppSettings, DesktopActionResult } from "../../desktop/types";
import { useAnimatedPresence } from "../../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import type { Project, View } from "../../types";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { NavButton } from "../common/NavButton";
import { SettingsMenu } from "./SettingsMenu";
import { SidebarProjectsSection } from "./projects/SidebarProjectsSection";

type SidebarProps = {
  projects: Project[];
  appSettings: AppSettings;
  activeView: View;
  selectedProjectId: string;
  selectedThreadId: string | null;
  settingsOpen: boolean;
  projectScopeLockActive: boolean;
  collapsedProjectIds: Record<string, boolean>;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
  onShowView: (view: View) => void;
  onToggleSettings: () => void;
  onOpenExtensionsView: () => void;
  onOpenSettingsPanel: () => void;
  onOpenArchivedThreads: () => void;
  onProjectSelect: (projectId: string) => void;
  onProjectReorder: (projectIds: string[]) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

export function Sidebar({
  projects,
  appSettings,
  activeView,
  selectedProjectId,
  selectedThreadId,
  settingsOpen,
  projectScopeLockActive,
  collapsedProjectIds,
  onAction,
  onShowView,
  onToggleSettings,
  onOpenExtensionsView,
  onOpenSettingsPanel,
  onOpenArchivedThreads,
  onProjectSelect,
  onProjectReorder,
  onThreadOpen,
  onToggleProjectCollapse,
}: SidebarProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuId = "sidebar-settings-menu";
  const settingsMenuPresent = useAnimatedPresence(settingsOpen);
  const codeModeActive =
    activeView === "code" ||
    activeView === "thread" ||
    activeView === "settings" ||
    activeView === "extensions";
  const showModeSelection = activeView !== "extensions";
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
    <aside
      aria-label="Workspace sidebar"
      data-pulse-active={projectScopeLockActive ? "true" : "false"}
      className="motion-surface-pulse motion-sidebar-selection-pulse relative flex h-full min-h-0 min-w-0 flex-col gap-3.5 overflow-hidden border-r border-[color:var(--border)] bg-[color:var(--sidebar)] px-2.5 pt-3 pb-2.5"
    >
      {showModeSelection ? (
        <nav className="grid gap-0.5" aria-label="Primary navigation">
          <NavButton
            icon={<MessageSquare size={16} />}
            label={
              <span className="inline-flex items-center gap-2">
                <span>Chat</span>
                <FeatureStatusBadge statusId="feature:sidebar.plugins" />
              </span>
            }
            active={activeView === "chat"}
            onClick={() => onShowView("chat")}
          />
          <NavButton
            icon={<PawPrint size={16} />}
            label={
              <span className="inline-flex items-center gap-2">
                <span>Claw</span>
                <FeatureStatusBadge statusId="feature:sidebar.automations" />
              </span>
            }
            active={activeView === "claw"}
            onClick={() => onShowView("claw")}
          />
          <NavButton
            icon={<BriefcaseBusiness size={16} />}
            label={
              <span className="inline-flex items-center gap-2">
                <span>Work</span>
                <FeatureStatusBadge statusId="feature:sidebar.debug" />
              </span>
            }
            active={activeView === "work"}
            onClick={() => onShowView("work")}
          />
          <NavButton
            icon={<Code2 size={16} />}
            label="Code"
            active={codeModeActive}
            onClick={() => onShowView("code")}
          />
        </nav>
      ) : null}

      <SidebarProjectsSection
        activeView={activeView}
        appSettings={appSettings}
        projects={projects}
        selectedProjectId={selectedProjectId}
        selectedThreadId={selectedThreadId}
        collapsedProjectIds={collapsedProjectIds}
        onAction={onAction}
        onOpenSettingsPanel={onOpenSettingsPanel}
        onProjectSelect={onProjectSelect}
        onProjectReorder={onProjectReorder}
        onThreadOpen={onThreadOpen}
        onToggleProjectCollapse={onToggleProjectCollapse}
      />

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
          onOpenExtensionsView={onOpenExtensionsView}
          onOpenSettingsPanel={onOpenSettingsPanel}
          onOpenArchivedThreads={onOpenArchivedThreads}
        />
      ) : null}
    </aside>
  );
}
