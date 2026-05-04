import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { getPersistedSessionPath, isLocalSessionPath } from "../../../shared/session-paths";
import { Sidebar } from "../components/sidebar/Sidebar";
import { TerminalPanel } from "../components/workspace/TerminalPanel";
import { defaultDiffBaseline } from "../components/workspace/composer/diff-baseline";
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { cn } from "../utils/cn";
import { AppShellOverlays } from "./AppShellOverlays";
import { AppShellWorkspace } from "./AppShellWorkspace";
import { appShellRootClass } from "./layout-classes";
import type { AppShellController } from "./useAppShellController";
import { useAppShellLayoutState } from "./useAppShellLayoutState";

const TERMINAL_DRAWER_WIDTH = "min(28rem, calc(100% - 2.5rem))";

type TakeoverTerminalKeyState = {
  key: string;
  projectId: string;
  threadId: string | null;
  sessionPath: string | null;
};

function isLocalToPersistedTakeoverTransition(
  previous: TakeoverTerminalKeyState,
  nextProjectId: string,
  nextThreadId: string | null,
  nextSessionPath: string | null,
) {
  return (
    previous.projectId === nextProjectId &&
    previous.threadId !== null &&
    previous.threadId === nextThreadId &&
    isLocalSessionPath(previous.sessionPath) &&
    getPersistedSessionPath(nextSessionPath) !== null
  );
}

function areDiffBaselinesEqual(left: ProjectDiffBaseline, right: ProjectDiffBaseline) {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "commit" && right.kind === "commit") {
    return left.sha === right.sha;
  }

  if (left.kind === "last-opened" && right.kind === "last-opened") {
    return left.rev === right.rev;
  }

  return true;
}

function isSameDraftPromotion({
  activeThreadId,
  messageCount,
  previousSessionPath,
  previousThreadId,
  nextSessionPath,
}: {
  activeThreadId: string | null;
  messageCount: number | null;
  previousSessionPath: string | null;
  previousThreadId: string | null;
  nextSessionPath: string | null;
}) {
  return (
    isLocalSessionPath(previousSessionPath) &&
    previousThreadId !== null &&
    previousThreadId.startsWith("local-thread-") &&
    activeThreadId !== null &&
    getPersistedSessionPath(nextSessionPath) !== null &&
    (messageCount === null || messageCount <= 1)
  );
}

type AppShellLayoutProps = {
  controller: AppShellController;
};

export function AppShellLayout({ controller }: AppShellLayoutProps) {
  const controllerRef = useRef(controller);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarCompactMode, setSidebarCompactMode] = useState(false);
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState(false);
  const [diffBaselineState, setDiffBaselineState] = useState<{
    projectId: string;
    threadId: string | null;
    sessionPath: string | null;
    baseline: ProjectDiffBaseline;
    source: "init" | "override" | "default";
  }>({
    projectId: "",
    threadId: null,
    sessionPath: null,
    baseline: defaultDiffBaseline,
    source: "init",
  });
  const [diffRenderModeState, setDiffRenderModeState] = useState<{
    projectId: string;
    threadId: string | null;
    sessionPath: string | null;
    renderMode: ProjectDiffRenderMode;
    source: "init" | "override" | "default";
  }>({
    projectId: "",
    threadId: null,
    sessionPath: null,
    renderMode: "stacked",
    source: "init",
  });
  const {
    activeComposerState,
    activeThreadData,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    handleAction,
    handleProjectReorder,
    handleProjectSelect,
    handleSetSelectedProject,
    handleShowView,
    handleThreadOpen,
    handleToggleProjectCollapse,
    handleToggleSettings,
    projects,
    extensionsProjectScopeActive,
    skillsProjectScopeActive,
    state,
  } = controller;
  const projectScopeLockActive = extensionsProjectScopeActive || skillsProjectScopeActive;
  const effectiveCollapsedProjectIds = projectScopeLockActive
    ? Object.fromEntries(projects.map((project) => [project.id, true]))
    : collapsedProjectIds;

  const terminalSessionPath =
    state.activeView === "chat" || state.activeView === "thread" || state.activeView === "gitops"
      ? state.selectedSessionPath
      : null;
  const activeThreadId =
    state.activeView === "chat" || state.activeView === "thread" || state.activeView === "gitops"
      ? state.selectedThreadId
      : null;
  const takeoverVisible = state.takeoverVisible;
  const terminalDrawerVisible = state.activeView === "thread" && state.terminalVisible;
  const terminalDrawerPresent = useAnimatedPresence(terminalDrawerVisible);
  const diffBaseline =
    diffBaselineState.projectId === composerProjectId &&
    diffBaselineState.threadId === activeThreadId &&
    diffBaselineState.sessionPath === terminalSessionPath
      ? diffBaselineState.baseline
      : (controller.activeThreadData?.diffPreferences?.baseline ??
        controller.shellState?.appSettings.gitDiffBaselineDefault ??
        defaultDiffBaseline);
  const diffRenderMode =
    diffRenderModeState.projectId === composerProjectId &&
    diffRenderModeState.threadId === activeThreadId &&
    diffRenderModeState.sessionPath === terminalSessionPath
      ? diffRenderModeState.renderMode
      : (controller.activeThreadData?.diffPreferences?.renderMode ??
        controller.shellState?.appSettings.gitDiffRenderModeDefault ??
        "stacked");
  const { mainSectionRef, takeoverPresent, workspaceContentClass } = useAppShellLayoutState({
    takeoverVisible,
  });
  const takeoverTerminalKeyRef = useRef<TakeoverTerminalKeyState | null>(null);
  const nextTakeoverTerminalKey = `${composerProjectId}:${
    state.selectedThreadId ?? terminalSessionPath ?? "none"
  }`;
  const nextTakeoverTerminalKeyState: TakeoverTerminalKeyState = {
    key: nextTakeoverTerminalKey,
    projectId: composerProjectId,
    threadId: state.selectedThreadId,
    sessionPath: terminalSessionPath,
  };

  if (takeoverVisible && takeoverTerminalKeyRef.current === null) {
    takeoverTerminalKeyRef.current = nextTakeoverTerminalKeyState;
  } else if (
    takeoverVisible &&
    takeoverTerminalKeyRef.current !== null &&
    takeoverTerminalKeyRef.current.key !== nextTakeoverTerminalKey &&
    !isLocalToPersistedTakeoverTransition(
      takeoverTerminalKeyRef.current,
      composerProjectId,
      state.selectedThreadId,
      terminalSessionPath,
    )
  ) {
    takeoverTerminalKeyRef.current = nextTakeoverTerminalKeyState;
  } else if (!takeoverVisible && !takeoverPresent) {
    takeoverTerminalKeyRef.current = null;
  }

  const takeoverTerminalKey = takeoverTerminalKeyRef.current?.key ?? nextTakeoverTerminalKey;
  controllerRef.current = controller;

  useEffect(() => {
    setDiffBaselineState((current) => {
      const nextBaseline =
        controller.activeThreadData?.diffPreferences?.baseline ??
        controller.shellState?.appSettings.gitDiffBaselineDefault ??
        defaultDiffBaseline;
      if (
        current.projectId === composerProjectId &&
        current.source === "override" &&
        isSameDraftPromotion({
          activeThreadId,
          messageCount: controller.activeThreadData?.messages.length ?? null,
          previousSessionPath: current.sessionPath,
          previousThreadId: current.threadId,
          nextSessionPath: terminalSessionPath,
        })
      ) {
        const appDefault = controllerRef.current.shellState?.appSettings.gitDiffBaselineDefault;
        const nextBaseline =
          appDefault && areDiffBaselinesEqual(current.baseline, appDefault)
            ? null
            : current.baseline;
        void controllerRef.current.handleAction("workspace.diff-preferences", {
          diffBaseline: nextBaseline,
        });
        return {
          ...current,
          threadId: activeThreadId,
          sessionPath: terminalSessionPath,
        };
      }

      if (
        current.projectId === composerProjectId &&
        current.threadId === activeThreadId &&
        current.sessionPath === terminalSessionPath &&
        (current.source === "override" || areDiffBaselinesEqual(current.baseline, nextBaseline))
      ) {
        return current;
      }

      return {
        projectId: composerProjectId,
        threadId: activeThreadId,
        sessionPath: terminalSessionPath,
        baseline: nextBaseline,
        source: "init",
      };
    });
  }, [
    activeThreadId,
    composerProjectId,
    controller.activeThreadData,
    controller.shellState,
    terminalSessionPath,
  ]);

  useEffect(() => {
    setDiffRenderModeState((current) => {
      const nextRenderMode =
        controller.activeThreadData?.diffPreferences?.renderMode ??
        controller.shellState?.appSettings.gitDiffRenderModeDefault ??
        "stacked";
      if (
        current.projectId === composerProjectId &&
        current.source === "override" &&
        isSameDraftPromotion({
          activeThreadId,
          messageCount: controller.activeThreadData?.messages.length ?? null,
          previousSessionPath: current.sessionPath,
          previousThreadId: current.threadId,
          nextSessionPath: terminalSessionPath,
        })
      ) {
        const appDefault = controllerRef.current.shellState?.appSettings.gitDiffRenderModeDefault;
        const nextRenderMode = appDefault === current.renderMode ? null : current.renderMode;
        void controllerRef.current.handleAction("workspace.diff-preferences", {
          diffRenderMode: nextRenderMode,
        });
        return {
          ...current,
          threadId: activeThreadId,
          sessionPath: terminalSessionPath,
        };
      }

      if (
        current.projectId === composerProjectId &&
        current.threadId === activeThreadId &&
        current.sessionPath === terminalSessionPath &&
        (current.source === "override" || current.renderMode === nextRenderMode)
      ) {
        return current;
      }

      return {
        projectId: composerProjectId,
        threadId: activeThreadId,
        sessionPath: terminalSessionPath,
        renderMode: nextRenderMode,
        source: "init",
      };
    });
  }, [
    activeThreadId,
    composerProjectId,
    controller.activeThreadData,
    controller.shellState,
    terminalSessionPath,
  ]);

  const handleSetDiffBaseline = useCallback(
    (baseline: ProjectDiffBaseline) => {
      const appDefault = controllerRef.current.shellState?.appSettings.gitDiffBaselineDefault;
      const nextBaseline =
        appDefault && areDiffBaselinesEqual(baseline, appDefault) ? null : baseline;
      setDiffBaselineState({
        projectId: composerProjectId,
        threadId: activeThreadId,
        sessionPath: terminalSessionPath,
        baseline,
        source: nextBaseline ? "override" : "default",
      });
      void controllerRef.current.handleAction("workspace.diff-preferences", {
        diffBaseline: nextBaseline,
      });
    },
    [activeThreadId, composerProjectId, terminalSessionPath],
  );

  const handleSetDiffRenderMode = useCallback(
    (renderMode: ProjectDiffRenderMode) => {
      const appDefault = controllerRef.current.shellState?.appSettings.gitDiffRenderModeDefault;
      const nextRenderMode = appDefault === renderMode ? null : renderMode;
      setDiffRenderModeState({
        projectId: composerProjectId,
        threadId: activeThreadId,
        sessionPath: terminalSessionPath,
        renderMode,
        source: nextRenderMode ? "override" : "default",
      });
      void controllerRef.current.handleAction("workspace.diff-preferences", {
        diffRenderMode: nextRenderMode,
      });
    },
    [activeThreadId, composerProjectId, terminalSessionPath],
  );

  const handleOpenGitOpsFromTakeover = useCallback(async () => {
    controllerRef.current.handleOpenGitOpsView();
    await controllerRef.current.handleCloseTakeoverTerminal({
      preserveSessionOverride: true,
      refreshThread: false,
    });
  }, []);

  useEffect(() => {
    const updateSidebarCompactMode = () => setSidebarCompactMode(window.innerWidth <= 1236);
    updateSidebarCompactMode();
    window.addEventListener("resize", updateSidebarCompactMode);
    return () => window.removeEventListener("resize", updateSidebarCompactMode);
  }, []);

  useEffect(() => {
    if (!sidebarCompactMode) setSidebarOverlayOpen(false);
  }, [sidebarCompactMode]);

  useEffect(() => {
    if (!sidebarOverlayOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (controllerRef.current.state.settingsOpen) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSidebarOverlayOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [sidebarOverlayOpen]);

  const handleToggleSidebar = useCallback(() => {
    if (sidebarCompactMode) {
      setSidebarCollapsed(false);
      setSidebarOverlayOpen((open) => !open);
      return;
    }
    setSidebarCollapsed((collapsed) => !collapsed);
  }, [sidebarCompactMode]);

  return (
    <>
      <div className={appShellRootClass}>
        <div
          className={
            sidebarCollapsed || sidebarCompactMode
              ? "relative w-0 min-w-0 shrink-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 ease-out pointer-events-none"
              : "relative w-[clamp(225px,calc(100vw_-_936px),300px)] min-w-0 shrink-0 overflow-hidden opacity-100 transition-[width,opacity] duration-200 ease-out"
          }
        >
          {sidebarCollapsed || sidebarCompactMode ? null : (
            <Sidebar
              projects={projects}
              inboxThreads={controller.inboxThreads}
              inboxLoading={controller.inboxLoading}
              chatSidebarLoading={controller.chatSidebarLoading}
              projectsLoading={controller.shellLoading}
              appLaunchedAtMs={controller.appLaunchedAtMs}
              appSettings={
                controller.shellState?.appSettings ?? {
                  chatModel: null,
                  chatThinkingLevel: null,
                  codeModel: null,
                  codeThinkingLevel: null,
                  gitCommitMessageModel: null,
                  gitCommitMessageThinkingLevel: "off",
                  skillCreatorModel: null,
                  skillCreatorThinkingLevel: "off",
                  composerStreamingBehavior: "followUp",
                  dictationModelId: null,
                  dictationMaxDurationSeconds: 180,
                  showDictationButton: true,
                  favoriteFolders: [],
                  projectImportState: null,
                  preferredProjectLocation: null,
                  initializeGitOnProjectCreate: false,
                  gitOpsDefaultMode: "commit",
                  gitDiffBaselineDefault: { kind: "head" },
                  gitDiffRenderModeDefault: "stacked",
                  gitDiffFileTreeDefaultVisible: true,
                  projectDeletionMode: "pi-only",
                  useAgentsSkillsPaths: false,
                  howcodeNativeAskQuestions: false,
                  piTuiTakeover: false,
                  hoverToFocus: true,
                  hoverToBlur: false,
                }
              }
              chatSidebarState={controller.chatSidebarState}
              activeView={state.activeView}
              protectedProjectId={
                controller.shellState?.resolvedCwd ?? controller.shellState?.cwd ?? null
              }
              selectedInboxSessionPath={state.selectedInboxSessionPath}
              selectedProjectId={state.selectedProjectId}
              selectedThreadId={state.selectedThreadId}
              selectedChatGroupId={controller.selectedChatGroupId}
              settingsOpen={state.settingsOpen}
              projectScopeLockActive={projectScopeLockActive}
              terminalRunningProjectIds={controller.terminalRunningProjectIds}
              terminalRunningSessionPaths={controller.terminalRunningSessionPaths}
              collapsedProjectIds={effectiveCollapsedProjectIds}
              onAction={handleAction}
              onShowView={handleShowView}
              onToggleSettings={handleToggleSettings}
              onOpenExtensionsView={() => {
                handleShowView("extensions");
              }}
              onOpenSkillsView={() => {
                handleShowView("skills");
              }}
              onOpenSettingsPanel={() => {
                handleShowView("settings");
              }}
              onOpenArchivedThreads={() => {
                handleShowView("archived");
              }}
              onDismissInboxThread={controller.handleDismissInboxThread}
              onCreateChatGroup={controller.handleCreateChatGroup}
              onSelectChatGroup={controller.handleSelectChatGroup}
              onNewChat={(groupId) => {
                controller.handleSelectChatGroup(groupId);
                void handleAction("thread.new", { chatGroupId: groupId });
              }}
              onRefreshChatSidebar={controller.refreshChatSidebarState}
              onProjectSelect={handleProjectSelect}
              onProjectPrimeSelection={handleSetSelectedProject}
              onProjectReorder={handleProjectReorder}
              onLoadProjectThreads={controller.handleLoadProjectThreads}
              onSelectInboxThread={controller.handleSelectInboxThread}
              onThreadOpen={handleThreadOpen}
              onToggleProjectCollapse={handleToggleProjectCollapse}
              compactMode={false}
            />
          )}
        </div>

        {sidebarCompactMode && sidebarOverlayOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-40 bg-transparent"
            aria-label="Close sidebar"
            onClick={() => setSidebarOverlayOpen(false)}
          />
        ) : null}

        {sidebarCompactMode && !sidebarOverlayOpen ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-[45] pb-4",
              terminalDrawerVisible ? "px-3" : "px-5",
            )}
          >
            <div className="grid w-full grid-cols-[minmax(2rem,1fr)_minmax(0,800px)_minmax(2rem,1fr)] items-end gap-2">
              <div
                className={cn(
                  "pointer-events-auto mb-1.5 min-w-0 justify-self-end self-end",
                  terminalDrawerVisible ? "justify-self-start" : "translate-x-10",
                )}
              >
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
                  onClick={handleToggleSidebar}
                  aria-label="Show sidebar"
                  data-tooltip="Show sidebar"
                  data-tooltip-placement="right"
                >
                  <PanelLeftOpen size={15} />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {sidebarCompactMode ? (
          <div
            className={`absolute top-0 bottom-0 left-0 z-50 w-[min(300px,calc(100%_-_2rem))] min-w-0 overflow-hidden transition-[transform,opacity] duration-200 ease-out ${sidebarOverlayOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"}`}
          >
            <Sidebar
              projects={projects}
              inboxThreads={controller.inboxThreads}
              inboxLoading={controller.inboxLoading}
              chatSidebarLoading={controller.chatSidebarLoading}
              projectsLoading={controller.shellLoading}
              appLaunchedAtMs={controller.appLaunchedAtMs}
              appSettings={
                controller.shellState?.appSettings ?? {
                  chatModel: null,
                  chatThinkingLevel: null,
                  codeModel: null,
                  codeThinkingLevel: null,
                  gitCommitMessageModel: null,
                  gitCommitMessageThinkingLevel: "off",
                  skillCreatorModel: null,
                  skillCreatorThinkingLevel: "off",
                  composerStreamingBehavior: "followUp",
                  dictationModelId: null,
                  dictationMaxDurationSeconds: 180,
                  showDictationButton: true,
                  favoriteFolders: [],
                  projectImportState: null,
                  preferredProjectLocation: null,
                  initializeGitOnProjectCreate: false,
                  gitOpsDefaultMode: "commit",
                  gitDiffBaselineDefault: { kind: "head" },
                  gitDiffRenderModeDefault: "stacked",
                  gitDiffFileTreeDefaultVisible: true,
                  projectDeletionMode: "pi-only",
                  useAgentsSkillsPaths: false,
                  howcodeNativeAskQuestions: false,
                  piTuiTakeover: false,
                  hoverToFocus: true,
                  hoverToBlur: false,
                }
              }
              chatSidebarState={controller.chatSidebarState}
              activeView={state.activeView}
              protectedProjectId={
                controller.shellState?.resolvedCwd ?? controller.shellState?.cwd ?? null
              }
              selectedInboxSessionPath={state.selectedInboxSessionPath}
              selectedProjectId={state.selectedProjectId}
              selectedThreadId={state.selectedThreadId}
              selectedChatGroupId={controller.selectedChatGroupId}
              settingsOpen={state.settingsOpen}
              projectScopeLockActive={projectScopeLockActive}
              terminalRunningProjectIds={controller.terminalRunningProjectIds}
              terminalRunningSessionPaths={controller.terminalRunningSessionPaths}
              collapsedProjectIds={effectiveCollapsedProjectIds}
              onAction={handleAction}
              onShowView={handleShowView}
              onToggleSettings={handleToggleSettings}
              onOpenExtensionsView={() => {
                handleShowView("extensions");
              }}
              onOpenSkillsView={() => {
                handleShowView("skills");
              }}
              onOpenSettingsPanel={() => {
                handleShowView("settings");
              }}
              onOpenArchivedThreads={() => {
                handleShowView("archived");
              }}
              onDismissInboxThread={controller.handleDismissInboxThread}
              onCreateChatGroup={controller.handleCreateChatGroup}
              onSelectChatGroup={controller.handleSelectChatGroup}
              onNewChat={(groupId) => {
                controller.handleSelectChatGroup(groupId);
                void handleAction("thread.new", { chatGroupId: groupId });
              }}
              onRefreshChatSidebar={controller.refreshChatSidebarState}
              onProjectSelect={handleProjectSelect}
              onProjectPrimeSelection={handleSetSelectedProject}
              onProjectReorder={handleProjectReorder}
              onLoadProjectThreads={controller.handleLoadProjectThreads}
              onSelectInboxThread={controller.handleSelectInboxThread}
              onThreadOpen={handleThreadOpen}
              onToggleProjectCollapse={handleToggleProjectCollapse}
              compactMode
              onCloseCompactSidebar={() => setSidebarOverlayOpen(false)}
            />
          </div>
        ) : null}

        <section
          ref={mainSectionRef}
          className="flex min-w-0 min-h-0 h-full flex-1 flex-col overflow-hidden bg-[color:var(--workspace)]"
        >
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              data-open={!takeoverVisible ? "true" : "false"}
              className="motion-desktop-workspace flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <AppShellWorkspace
                controller={controller}
                activeComposerState={activeComposerState}
                activeThreadData={activeThreadData}
                composerProjectId={composerProjectId}
                currentProjectName={currentProjectName}
                diffBaseline={diffBaseline}
                diffRenderMode={diffRenderMode}
                terminalDrawerVisible={terminalDrawerVisible}
                terminalSessionPath={terminalSessionPath}
                workspaceContentClass={workspaceContentClass}
                onSetDiffBaseline={handleSetDiffBaseline}
                onSetDiffRenderMode={handleSetDiffRenderMode}
                sidebarCollapsed={sidebarCollapsed}
                sidebarAutoHidden={sidebarCompactMode}
                sidebarCompactMode={sidebarCompactMode}
                onToggleSidebar={handleToggleSidebar}
              />
            </div>

            <AppShellOverlays
              controller={controller}
              composerProjectId={composerProjectId}
              diffBaseline={diffBaseline}
              takeoverPresent={takeoverPresent}
              takeoverVisible={takeoverVisible}
              takeoverTerminalKey={takeoverTerminalKey}
              terminalDrawerVisible={terminalDrawerVisible}
              terminalSessionPath={terminalSessionPath}
              terminalDrawerOverlay={sidebarCompactMode}
              workspaceContentClass={workspaceContentClass}
              onOpenGitOps={handleOpenGitOpsFromTakeover}
              onSetDiffBaseline={handleSetDiffBaseline}
              hoverToFocus={controller.shellState?.appSettings.hoverToFocus ?? true}
              hoverToBlur={controller.shellState?.appSettings.hoverToBlur ?? false}
            />

            {terminalDrawerPresent ? (
              <div
                className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 max-w-full overflow-hidden"
                style={{ width: sidebarCompactMode ? "100%" : TERMINAL_DRAWER_WIDTH }}
              >
                <div
                  data-open={terminalDrawerVisible ? "true" : "false"}
                  className={`motion-terminal-drawer absolute inset-0 min-h-0 min-w-0 ${terminalDrawerVisible ? "pointer-events-auto" : "pointer-events-none"}`}
                >
                  <TerminalPanel
                    projectId={composerProjectId}
                    sessionPath={terminalSessionPath}
                    onClose={controller.handleCloseTerminalDrawer}
                    hoverToFocus={controller.shellState?.appSettings.hoverToFocus ?? true}
                    hoverToBlur={controller.shellState?.appSettings.hoverToBlur ?? false}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
      {controller.toast ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-[color:var(--border-strong)] bg-[rgba(14,18,28,0.94)] px-4 py-2 text-[13px] text-[color:var(--text)] shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-sm">
          {controller.toast}
        </div>
      ) : null}
    </>
  );
}
