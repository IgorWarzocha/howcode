import { BriefcaseBusiness, Code2, Inbox, MessageSquare, PawPrint, Settings } from "lucide-react";
import { useCallback, useRef } from "react";
import type { AppSettings, DesktopActionInvoker, InboxThread } from "../../desktop/types";
import type { ChatSidebarState } from "../../desktop/types";
import { useAnimatedPresence } from "../../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import type { Project, View } from "../../types";

type SidebarNavigableView = Exclude<View, "gitops">;
import { NavButton } from "../common/NavButton";
import { SettingsMenu } from "./SettingsMenu";
import { SidebarChatSection } from "./chat/SidebarChatSection";
import { SidebarInboxSection } from "./inbox/SidebarInboxSection";
import { SidebarProjectsSection } from "./projects/SidebarProjectsSection";

type SidebarProps = {
  projects: Project[];
  inboxThreads: InboxThread[];
  chatSidebarState: ChatSidebarState | null;
  appLaunchedAtMs: number;
  appSettings: AppSettings;
  protectedProjectId?: string | null;
  activeView: View;
  selectedInboxSessionPath: string | null;
  selectedProjectId: string;
  selectedThreadId: string | null;
  selectedChatGroupId: string | null;
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
  onCreateChatGroup: (name: string) => Promise<unknown>;
  onSelectChatGroup: (groupId: string | null) => void;
  onNewChat: (groupId: string | null) => void;
  onRefreshChatSidebar: () => Promise<unknown>;
  onProjectSelect: (projectId: string) => void;
  onProjectReorder: (projectIds: string[]) => void;
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>;
  onSelectInboxThread: (thread: InboxThread) => void;
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
};

export function Sidebar({
  projects,
  inboxThreads,
  chatSidebarState,
  appLaunchedAtMs,
  appSettings,
  protectedProjectId = null,
  activeView,
  selectedInboxSessionPath,
  selectedProjectId,
  selectedThreadId,
  selectedChatGroupId,
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
  onCreateChatGroup,
  onSelectChatGroup,
  onNewChat,
  onRefreshChatSidebar,
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
      className="sidebar-shell motion-surface-pulse motion-sidebar-selection-pulse relative"
    >
      {showModeSelection ? (
        <nav className="sidebar-mode-nav" aria-label="Primary navigation">
          <NavButton
            icon={<PawPrint size={16} />}
            label={
              <span className="sidebar-mode-label">
                <span>Claw</span>
                <span className="sidebar-coming-soon-label">Coming soon</span>
              </span>
            }
            active={activeView === "claw"}
            disabled
            title="Coming soon"
          />
          <NavButton
            icon={<BriefcaseBusiness size={16} />}
            label={
              <span className="sidebar-mode-label">
                <span>Work</span>
                <span className="sidebar-coming-soon-label">Coming soon</span>
              </span>
            }
            active={activeView === "work"}
            disabled
            title="Coming soon"
          />
          <NavButton
            icon={<Inbox size={16} />}
            label="Inbox"
            active={activeView === "inbox"}
            onClick={() => onShowView("inbox")}
          />
          <NavButton
            icon={<MessageSquare size={16} />}
            label="Chat"
            active={activeView === "chat"}
            onClick={() => onShowView("chat")}
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
      ) : activeView === "chat" ? (
        <SidebarChatSection
          chatState={chatSidebarState}
          selectedGroupId={selectedChatGroupId}
          selectedThreadId={selectedThreadId}
          onAction={onAction}
          onCreateGroup={onCreateChatGroup}
          onSelectGroup={onSelectChatGroup}
          onNewChat={onNewChat}
          onRefresh={onRefreshChatSidebar}
          onThreadOpen={onThreadOpen}
        />
      ) : (
        <SidebarProjectsSection
          activeView={activeView}
          appLaunchedAtMs={appLaunchedAtMs}
          appSettings={appSettings}
          protectedProjectId={protectedProjectId}
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

      <div className="sidebar-footer">
        <button
          ref={settingsButtonRef}
          type="button"
          className="sidebar-settings-button"
          onClick={onToggleSettings}
          data-open={settingsOpen ? "true" : "false"}
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
