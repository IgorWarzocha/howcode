import {
  ChevronDown,
  CopyPlus,
  Grip,
  MoreHorizontal,
  PanelBottom,
  PanelRight,
  Play,
} from "lucide-react";
import { useRef, useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
import { getFeatureStatusButtonClass } from "../../features/feature-status";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import type { Project, View } from "../../types";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { IconButton } from "../common/IconButton";
import { TextButton } from "../common/TextButton";
import { ProductMenu } from "./header/ProductMenu";
import { ProjectSwitchMenu } from "./header/ProjectSwitchMenu";
import { RunActionMenu } from "./header/RunActionMenu";
import { ThreadActionsMenu } from "./header/ThreadActionsMenu";

type WorkspaceHeaderProps = {
  activeView: View;
  currentTitle: string;
  currentProjectName: string;
  diffVisible: boolean;
  projects: Project[];
  selectedProjectId: string;
  selectedThreadId: string | null;
  sidebarVisible: boolean;
  terminalVisible: boolean;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onArchiveSelectedThread: () => void;
  onDeleteSelectedThread: () => void;
  onOpenArchivedThreads: () => void;
  onOpenSettingsPanel: () => void;
  onProjectSwitch: (projectId: string) => void;
  onToggleDiff: () => void;
  onToggleTerminal: () => void;
};

export function WorkspaceHeader({
  activeView,
  currentTitle,
  currentProjectName,
  diffVisible,
  projects,
  selectedProjectId,
  selectedThreadId,
  sidebarVisible,
  terminalVisible,
  onAction,
  onArchiveSelectedThread,
  onDeleteSelectedThread,
  onOpenArchivedThreads,
  onOpenSettingsPanel,
  onProjectSwitch,
  onToggleDiff,
  onToggleTerminal,
}: WorkspaceHeaderProps) {
  const [openMenu, setOpenMenu] = useState<"product" | "project" | "run" | "thread" | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectContainerRef = useRef<HTMLDivElement>(null);
  const threadMenuRef = useRef<HTMLDivElement>(null);
  const threadContainerRef = useRef<HTMLDivElement>(null);
  const runMenuRef = useRef<HTMLDivElement>(null);
  const runContainerRef = useRef<HTMLDivElement>(null);
  const productMenuRef = useRef<HTMLDivElement>(null);
  const productContainerRef = useRef<HTMLDivElement>(null);

  useDismissibleLayer({
    open: openMenu !== null,
    onDismiss: () => setOpenMenu(null),
    refs: [
      projectContainerRef,
      threadContainerRef,
      runContainerRef,
      productContainerRef,
      projectMenuRef,
      threadMenuRef,
      runMenuRef,
      productMenuRef,
    ],
  });

  const productMenuId = "header-product-menu";
  const projectMenuId = "header-project-menu";
  const threadMenuId = "header-thread-menu";
  const runMenuId = "header-run-menu";

  return (
    <header
      className={
        sidebarVisible
          ? "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 pt-2.5 pb-2 max-md:grid-cols-1"
          : "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 pt-2.5 pb-2 pl-16 max-md:grid-cols-1"
      }
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 truncate text-[12.5px] leading-5 text-[color:var(--muted)]">
          <span className="truncate text-[13.5px] text-[color:var(--text)]">{currentTitle}</span>
          {activeView === "thread" ? (
            <>
              <div ref={projectContainerRef} className="relative">
                <TextButton
                  className={cn(
                    "inline-flex items-center gap-2 px-0.5 py-0 text-[12px] text-[color:var(--muted)] hover:text-[color:var(--text)]",
                    getFeatureStatusButtonClass("feature:header.project-switch"),
                  )}
                  onClick={() =>
                    setOpenMenu((current) => (current === "project" ? null : "project"))
                  }
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "project"}
                  aria-controls={projectMenuId}
                >
                  {currentProjectName}
                  <FeatureStatusBadge statusId="feature:header.project-switch" />
                </TextButton>
                {openMenu === "project" ? (
                  <ProjectSwitchMenu
                    menuId={projectMenuId}
                    panelRef={projectMenuRef}
                    projects={projects}
                    selectedProjectId={selectedProjectId}
                    onSelectProject={(projectId) => {
                      setOpenMenu(null);
                      onProjectSwitch(projectId);
                    }}
                  />
                ) : null}
              </div>

              <div ref={threadContainerRef} className="relative">
                <IconButton
                  label="Thread actions"
                  onClick={() => setOpenMenu((current) => (current === "thread" ? null : "thread"))}
                  icon={<MoreHorizontal size={16} />}
                  className={getFeatureStatusButtonClass("feature:header.thread-actions")}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "thread"}
                  aria-controls={threadMenuId}
                />
                {openMenu === "thread" && selectedThreadId ? (
                  <ThreadActionsMenu
                    menuId={threadMenuId}
                    panelRef={threadMenuRef}
                    onArchiveThread={() => {
                      setOpenMenu(null);
                      onArchiveSelectedThread();
                    }}
                    onDeleteThread={() => {
                      setOpenMenu(null);
                      onDeleteSelectedThread();
                    }}
                  />
                ) : null}
              </div>

              <div ref={runContainerRef} className="relative">
                <IconButton
                  label="Set up a run action"
                  onClick={() => setOpenMenu((current) => (current === "run" ? null : "run"))}
                  icon={<Play size={16} />}
                  className={getFeatureStatusButtonClass("feature:header.thread-run-action")}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "run"}
                  aria-controls={runMenuId}
                />
                {openMenu === "run" ? (
                  <RunActionMenu
                    diffVisible={diffVisible}
                    menuId={runMenuId}
                    panelRef={runMenuRef}
                    terminalVisible={terminalVisible}
                    onOpenBoth={() => {
                      setOpenMenu(null);
                      if (!terminalVisible) {
                        onToggleTerminal();
                      }
                      if (!diffVisible) {
                        onToggleDiff();
                      }
                    }}
                    onToggleDiff={() => {
                      setOpenMenu(null);
                      onToggleDiff();
                    }}
                    onToggleTerminal={() => {
                      setOpenMenu(null);
                      onToggleTerminal();
                    }}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div ref={productContainerRef} className="relative">
        <button
          type="button"
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[rgba(39,43,57,0.72)] px-2.5 text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
            getFeatureStatusButtonClass("feature:header.product-menu"),
          )}
          onClick={() => setOpenMenu((current) => (current === "product" ? null : "product"))}
          data-feature-id="feature:header.product-menu"
          aria-haspopup="menu"
          aria-expanded={openMenu === "product"}
          aria-controls={productMenuId}
        >
          <div className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] bg-[linear-gradient(135deg,#f6eb82,#7ab0ff)] text-[11px] font-bold text-[#171821]">
            P
          </div>
          <FeatureStatusBadge statusId="feature:header.product-menu" />
          <ChevronDown size={14} className="text-[color:var(--muted)]" />
        </button>
        {openMenu === "product" ? (
          <ProductMenu
            menuId={productMenuId}
            panelRef={productMenuRef}
            onOpenArchivedThreads={() => {
              setOpenMenu(null);
              onOpenArchivedThreads();
            }}
            onOpenSettings={() => {
              setOpenMenu(null);
              onOpenSettingsPanel();
            }}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2 max-md:flex-wrap">
        <div className="h-5 w-px bg-[color:var(--border)] max-md:hidden" />
        <IconButton
          label="Toggle terminal"
          active={terminalVisible}
          onClick={onToggleTerminal}
          icon={<PanelBottom size={16} />}
          className={getFeatureStatusButtonClass("feature:header.terminal-toggle")}
        />
        <IconButton
          label="Toggle diff panel"
          active={diffVisible}
          onClick={onToggleDiff}
          icon={<PanelRight size={16} />}
          className={getFeatureStatusButtonClass("feature:header.diff-toggle")}
        />
        <IconButton
          label="Open in Popout Window"
          onClick={() => onAction("workspace.popout")}
          icon={<Grip size={16} />}
          className={getFeatureStatusButtonClass("feature:header.workspace-popout")}
        />
        <IconButton
          label="Duplicate workspace"
          onClick={() => onAction("workspace.secondary")}
          icon={<CopyPlus size={16} />}
          className={getFeatureStatusButtonClass("feature:header.workspace-secondary")}
        />
      </div>
    </header>
  );
}
