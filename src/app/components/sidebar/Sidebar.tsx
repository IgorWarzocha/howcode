import { BriefcaseBusiness, Code2, Inbox, MessageSquare, PawPrint, Settings } from "lucide-react";
import { useCallback, useRef } from "react";
import type { AppSettings, DesktopActionInvoker, InboxThread } from "../../desktop/types";
import { useAnimatedPresence } from "../../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import type { Project, View } from "../../types";

type SidebarNavigableView = Exclude<View, "gitops">;
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { NavButton } from "../common/NavButton";
import { SettingsMenu } from "./SettingsMenu";
import { SidebarInboxSection } from "./inbox/SidebarInboxSection";
import { SidebarProjectsSection } from "./projects/SidebarProjectsSection";

type SidebarProps = {
  projects: Project[];
  inboxThreads: InboxThread[];
  appLaunchedAtMs: number;
  appSettings: AppSettings;
  activeView: View;
  selectedInboxSessionPath: string | null;
  selectedProjectId: string;
  selectedThreadId: string | null;
  settingsOpen: boolean;
  projectScopeLockActive: boolean;
  terminalRunningProjectIds: ReadonlySet<string>;
  terminalRunningSessionPaths: ReadonlySet<string>;
  collapsedProjectIds: Record<string, boolean>;
  onAction: DesktopActionInvoker;
  onShowView: (view: SidebarNavigableView) => void;
  onToggleSettings: () => void;
  onOpenExtensionsView: () => void;
  onOpenSkillsView: () => void;
  onOpenSettingsPanel: () => void;
  onOpenArchivedThreads: () => void;
  onDismissInboxThread: (thread: InboxThread) => void;
  onProjectSelect: (projectId: string) => void;
  onProjectReorder: (projectIds: string[]) => void;
  onLoadProjectThreads: (projectId: string) => Promise<unknown>;
  onSelectInboxThread: (thread: InboxThread) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

function ComingSoonLabel() {
  return (
    <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-2)]">
      Coming soon
    </span>
  );
}

export function Sidebar({
  projects,
  inboxThreads,
  appLaunchedAtMs,
  appSettings,
  activeView,
  selectedInboxSessionPath,
  selectedProjectId,
  selectedThreadId,
  settingsOpen,
  projectScopeLockActive,
  terminalRunningProjectIds,
  terminalRunningSessionPaths,
  collapsedProjectIds,
  onAction,
  onShowView,
  onToggleSettings,
  onOpenExtensionsView,
  onOpenSkillsView,
  onOpenSettingsPanel,
  onOpenArchivedThreads,
  onDismissInboxThread,
  onProjectSelect,
  onProjectReorder,
  onLoadProjectThreads,
  onSelectInboxThread,
  onThreadOpen,
  onToggleProjectCollapse,
}: SidebarProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuId = "sidebar-settings-menu";
  const settingsMenuPresent = useAnimatedPresence(settingsOpen);
  const codeModeActive =
    activeView === "inbox" ||
    activeView === "code" ||
    activeView === "thread" ||
    activeView === "gitops" ||
    activeView === "archived" ||
    activeView === "settings" ||
    activeView === "extensions" ||
    activeView === "skills";
  const showModeSelection = activeView !== "extensions" && activeView !== "skills";
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
            icon={<Inbox size={16} />}
            label={
              <span className="inline-flex items-center gap-2">
                <span>Inbox</span>
                <FeatureStatusBadge statusId="feature:sidebar.inbox" />
              </span>
            }
            active={activeView === "inbox"}
            onClick={() => onShowView("inbox")}
          />
          <NavButton
            icon={<MessageSquare size={16} />}
            label={
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>Chat</span>
                <ComingSoonLabel />
              </span>
            }
            active={activeView === "chat"}
            onClick={() => onShowView("chat")}
          />
          <NavButton
            icon={<PawPrint size={16} />}
            label={
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>Claw</span>
                <ComingSoonLabel />
              </span>
            }
            active={activeView === "claw"}
            onClick={() => onShowView("claw")}
          />
          <NavButton
            icon={<BriefcaseBusiness size={16} />}
            label={
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>Work</span>
                <ComingSoonLabel />
              </span>
            }
            active={activeView === "work"}
            onClick={() => onShowView("work")}
          />
          <NavButton
            icon={<Code2 size={16} />}
            label="Code"
            active={codeModeActive && activeView !== "inbox"}
            onClick={() => onShowView("code")}
          />
        </nav>
      ) : null}

      {activeView === "inbox" ? (
        <SidebarInboxSection
          appLaunchedAtMs={appLaunchedAtMs}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          threads={inboxThreads}
          selectedSessionPath={selectedInboxSessionPath}
          onDismissThread={onDismissInboxThread}
          onSelectThread={onSelectInboxThread}
        />
      ) : (
        <SidebarProjectsSection
          activeView={activeView}
          appLaunchedAtMs={appLaunchedAtMs}
          appSettings={appSettings}
          projectScopeLockActive={projectScopeLockActive}
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedThreadId={selectedThreadId}
          terminalRunningProjectIds={terminalRunningProjectIds}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          collapsedProjectIds={collapsedProjectIds}
          onAction={onAction}
          onLoadProjectThreads={onLoadProjectThreads}
          onOpenSettingsPanel={onOpenSettingsPanel}
          onProjectSelect={onProjectSelect}
          onProjectReorder={onProjectReorder}
          onThreadOpen={onThreadOpen}
          onToggleProjectCollapse={onToggleProjectCollapse}
        />
      )}

      <div className="relative mt-auto">
        <button
          ref={settingsButtonRef}
          type="button"
          className={cn(
            "flex min-h-[34px] w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 text-[14px] text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
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
            onOpenSkillsView={onOpenSkillsView}
            onOpenSettingsPanel={onOpenSettingsPanel}
            onOpenArchivedThreads={onOpenArchivedThreads}
          />
        ) : null}
      </div>
    </aside>
  );
}
