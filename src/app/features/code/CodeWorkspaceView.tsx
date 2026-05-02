import { useEffect, useRef, useState } from "react";
import { FolderGit2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { AppShellController } from "../../app-shell/useAppShellController";
import { defaultPiSettings } from "../../../../shared/default-pi-settings";
import { Composer } from "../../components/workspace/Composer";
import { DiffPanel } from "../../components/workspace/DiffPanel";
import { GitOpsComposerPanel } from "../../components/workspace/GitOpsComposerPanel";
import { QueuedPromptsCard } from "../../components/workspace/composer/QueuedPromptsCard";
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from "../../desktop/types";
import type { Message } from "../../types";
import { useDesktopDiff } from "../../hooks/useDesktopDiff";
import { mainPanelClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { CodeWorkspaceMainView } from "./CodeWorkspaceMainView";
import { DesktopComposerStatus } from "./DesktopComposerStatus";
import { useDiffCommentController } from "./useDiffCommentController";
import { useQueuedPromptRestore } from "./useQueuedPromptRestore";
import { useWorkspaceFooterHeight } from "./useWorkspaceFooterHeight";

type CodeWorkspaceViewProps = {
  controller: AppShellController;
  activeComposerState: AppShellController["activeComposerState"];
  activeThreadData: AppShellController["activeThreadData"];
  composerProjectId: string;
  currentProjectName: string;
  diffBaseline: ProjectDiffBaseline;
  diffRenderMode: ProjectDiffRenderMode;
  terminalDrawerVisible: boolean;
  terminalSessionPath: string | null;
  workspaceContentClass: string;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

const TERMINAL_DRAWER_OFFSET = "min(28rem, calc(100% - 2.5rem))";

function getReplyActivityKey(messages: readonly Message[]) {
  return messages
    .filter((message) => message.role !== "user")
    .map((message) => message.id)
    .join("|");
}

export function CodeWorkspaceView({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffBaseline,
  diffRenderMode,
  terminalDrawerVisible,
  terminalSessionPath,
  workspaceContentClass,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  sidebarCollapsed,
  onToggleSidebar,
}: CodeWorkspaceViewProps) {
  const [composerPromptResetKey, setComposerPromptResetKey] = useState(0);
  const [gitOpsFileTreeVisibilityByThread, setGitOpsFileTreeVisibilityByThread] = useState<
    Record<string, boolean>
  >({});
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0);
  const footerRef = useRef<HTMLElement>(null);
  const mainViewRef = useRef<HTMLElement>(null);
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleCloseGitOpsView,
    handleOpenGitOpsView,
    handleOpenWorktreeDiffFile,
    handleShowTakeoverTerminal,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    projectGitState,
    shellState,
    state,
  } = controller;
  const showWorkspaceFooter = state.activeView === "thread" || state.activeView === "gitops";
  const showThreadFooter = state.activeView === "thread";
  const showDiffInMainView = state.activeView === "gitops";
  const showDesktopTerminalDrawer = state.activeView === "thread" && terminalDrawerVisible;
  const gitOpsFileTreeStateKey = `${composerProjectId}:${terminalSessionPath ?? "project"}`;
  const gitOpsFileTreeVisible =
    gitOpsFileTreeVisibilityByThread[gitOpsFileTreeStateKey] ??
    shellState?.appSettings.gitDiffFileTreeDefaultVisible ??
    true;
  const toggleGitOpsFileTree = () => {
    setGitOpsFileTreeVisibilityByThread((current) => ({
      ...current,
      [gitOpsFileTreeStateKey]: !(current[gitOpsFileTreeStateKey] ?? gitOpsFileTreeVisible),
    }));
  };
  const { error: diffLoadError } = useDesktopDiff(
    composerProjectId,
    diffBaseline,
    showDiffInMainView && (projectGitState?.isGitRepo ?? false),
  );
  const footerHeight = useWorkspaceFooterHeight({
    footerRef,
    visible: showWorkspaceFooter,
  });
  const hasThreadConversation = showThreadFooter && (activeThreadData?.messages.length ?? 0) > 0;
  const [threadContentVisible, setThreadContentVisible] = useState(hasThreadConversation);
  const previousHasThreadConversationRef = useRef(hasThreadConversation);
  const centerThreadFooter = showThreadFooter && !hasThreadConversation;
  const footerInset = showWorkspaceFooter && !centerThreadFooter ? footerHeight : 0;

  useEffect(() => {
    if (!hasThreadConversation) {
      previousHasThreadConversationRef.current = false;
      setThreadContentVisible(false);
      return;
    }

    if (previousHasThreadConversationRef.current) {
      setThreadContentVisible(true);
      return;
    }

    previousHasThreadConversationRef.current = true;
    const timeout = window.setTimeout(() => setThreadContentVisible(true), 300);
    return () => window.clearTimeout(timeout);
  }, [hasThreadConversation]);
  const {
    diffCommentCount,
    diffCommentError,
    diffComments,
    diffCommentsSending,
    handleSelectDiffComment,
    handleSendDiffComments,
    selectedDiffCommentId,
    selectedDiffCommentJumpKey,
  } = useDiffCommentController({
    composerProjectId,
    handleAction,
    handleOpenWorktreeDiffFile,
    setComposerPromptResetKey,
    shellState,
  });
  const {
    handleEditQueuedPrompt,
    handleRemoveQueuedPrompt,
    markRestoredQueuedPromptApplied,
    pendingQueuedPromptIdsForSession,
    scopedRestoredQueuedPrompt,
  } = useQueuedPromptRestore({
    composerProjectId,
    handleAction,
    terminalSessionPath,
  });

  const terminalDrawerInsetStyle = showDesktopTerminalDrawer
    ? { right: TERMINAL_DRAWER_OFFSET }
    : undefined;
  const threadFooterStyle = showThreadFooter
    ? {
        ...terminalDrawerInsetStyle,
        top: centerThreadFooter ? "50%" : `calc(100% - ${footerHeight}px)`,
      }
    : terminalDrawerInsetStyle;
  const visibleThreadData =
    state.activeView === "thread" && activeThreadData && !threadContentVisible
      ? { ...activeThreadData, messages: [] }
      : activeThreadData;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className="motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden px-5"
        style={{ ...terminalDrawerInsetStyle, bottom: `${footerInset}px` }}
      >
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
          <main
            ref={mainViewRef}
            className={
              state.activeView === "thread" || showDiffInMainView
                ? "min-h-0 overflow-hidden pt-1.5"
                : mainPanelClass
            }
          >
            {showDiffInMainView ? (
              <DiffPanel
                projectId={composerProjectId}
                isGitRepo={projectGitState?.isGitRepo ?? false}
                baseline={diffBaseline}
                selectedFilePath={state.selectedDiffFilePath}
                selectedCommentId={selectedDiffCommentId}
                selectedCommentJumpKey={selectedDiffCommentJumpKey}
                diffRenderMode={diffRenderMode}
                layoutMode="main"
                showFileTree={gitOpsFileTreeVisible}
              />
            ) : (
              <CodeWorkspaceMainView
                activeView={state.activeView}
                appSettings={
                  shellState?.appSettings ?? {
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
                    piTuiTakeover: false,
                  }
                }
                piSettings={shellState?.piSettings ?? defaultPiSettings}
                archivedThreads={controller.archivedThreads}
                availableModels={activeComposerState?.availableModels ?? []}
                availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ["off"]}
                contextUsage={activeComposerState?.contextUsage ?? null}
                currentModel={activeComposerState?.currentModel ?? null}
                currentThinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                isCompacting={activeComposerState?.isCompacting ?? false}
                currentProjectName={currentProjectName}
                selectedInboxThread={controller.selectedInboxThread}
                projects={controller.projects}
                selectedProjectId={controller.state.selectedProjectId}
                workspaceContentClass={workspaceContentClass}
                threadData={visibleThreadData}
                composerLayoutVersion={composerLayoutVersion}
                onAction={handleAction}
                onDismissInboxThread={controller.handleDismissInboxThread}
                onListAttachmentEntries={listComposerAttachmentEntries}
                onOpenThread={controller.handleThreadOpen}
                onOpenSettingsView={() => controller.handleShowView("settings")}
                onCloseUtilityView={controller.handleCloseUtilityView}
                onLoadEarlierMessages={handleLoadEarlierMessages}
                onSetExtensionsProjectScopeActive={controller.handleSetExtensionsProjectScopeActive}
                onSetSkillsProjectScopeActive={controller.handleSetSkillsProjectScopeActive}
                onSelectProject={controller.handleProjectSelect}
              />
            )}
          </main>
        </div>
      </div>

      {showWorkspaceFooter ? (
        <footer
          ref={footerRef}
          className={cn(
            "motion-terminal-drawer-offset pointer-events-none absolute inset-x-0 z-10 px-5 pb-4",
            showThreadFooter ? "transition-[top,transform] duration-300 ease-out" : "bottom-0",
            centerThreadFooter && "-translate-y-1/2",
            showThreadFooter && !centerThreadFooter && "translate-y-0",
          )}
          style={threadFooterStyle}
        >
          <div className="pointer-events-auto grid gap-2.5">
            <div className="grid grid-cols-[minmax(0,1fr)_800px_minmax(0,1fr)] items-end gap-3">
              <div
                className={cn(
                  "mb-1.5 min-w-0 self-end",
                  state.activeView === "gitops" ? "opacity-100" : "opacity-0 xl:opacity-100",
                )}
              >
                {(state.activeView === "thread" || state.activeView === "gitops") &&
                !state.takeoverVisible ? (
                  <button
                    type="button"
                    className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[rgba(169,178,215,0.1)] hover:text-[color:var(--text)] hover:opacity-100"
                    onClick={onToggleSidebar}
                    aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                    data-tooltip={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                  >
                    {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
                  </button>
                ) : null}
              </div>
              <div className="w-[800px]">
                {state.activeView === "gitops" ? (
                  <div>
                    <GitOpsComposerPanel
                      dictationModelId={shellState?.appSettings.dictationModelId ?? null}
                      dictationMaxDurationSeconds={
                        shellState?.appSettings.dictationMaxDurationSeconds ?? 180
                      }
                      projectGitState={projectGitState}
                      projectId={composerProjectId}
                      sessionPath={terminalSessionPath}
                      showDictationButton={shellState?.appSettings.showDictationButton ?? true}
                      appSettings={
                        shellState?.appSettings ?? {
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
                          piTuiTakeover: false,
                        }
                      }
                      diffBaseline={diffBaseline}
                      diffRenderMode={diffRenderMode}
                      diffComments={diffComments}
                      diffCommentCount={diffCommentCount}
                      diffCommentsSending={diffCommentsSending}
                      diffCommentError={diffCommentError}
                      diffLoadError={diffLoadError}
                      onSetDiffBaseline={onSetDiffBaseline}
                      onSetDiffRenderMode={onSetDiffRenderMode}
                      onSendDiffComments={(message) => {
                        void handleSendDiffComments(message);
                      }}
                      onSelectDiffComment={handleSelectDiffComment}
                      onLayoutChange={() => setComposerLayoutVersion((current) => current + 1)}
                      onAction={handleAction}
                      onBack={handleCloseGitOpsView}
                      onOpenSettingsView={() => controller.handleShowView("settings")}
                    />
                  </div>
                ) : (
                  <div className="grid gap-0">
                    <QueuedPromptsCard
                      prompts={activeComposerState?.queuedPrompts ?? []}
                      pendingPromptIds={pendingQueuedPromptIdsForSession}
                      onEditPrompt={(prompt) => {
                        void handleEditQueuedPrompt(prompt);
                      }}
                      onRemovePrompt={(prompt) => {
                        void handleRemoveQueuedPrompt(prompt);
                      }}
                    />
                    <div>
                      <Composer
                        activeView={state.activeView}
                        model={activeComposerState?.currentModel ?? null}
                        contextUsage={activeComposerState?.contextUsage ?? null}
                        availableModels={activeComposerState?.availableModels ?? []}
                        isStreaming={activeThreadData?.isStreaming ?? false}
                        replyActivityKey={getReplyActivityKey(activeThreadData?.messages ?? [])}
                        isCompacting={activeComposerState?.isCompacting ?? false}
                        isExtensionCommandRunning={
                          activeComposerState?.isExtensionCommandRunning ?? false
                        }
                        thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                        restoredQueuedPrompt={scopedRestoredQueuedPrompt}
                        streamingBehaviorPreference={
                          shellState?.appSettings.composerStreamingBehavior ?? "followUp"
                        }
                        availableThinkingLevels={
                          activeComposerState?.availableThinkingLevels ?? ["off"]
                        }
                        projectId={composerProjectId}
                        projectGitState={projectGitState}
                        diffBaseline={diffBaseline}
                        sessionPath={terminalSessionPath}
                        dictationModelId={shellState?.appSettings.dictationModelId ?? null}
                        dictationMaxDurationSeconds={
                          shellState?.appSettings.dictationMaxDurationSeconds ?? 180
                        }
                        favoriteFolders={shellState?.appSettings.favoriteFolders ?? []}
                        showDictationButton={shellState?.appSettings.showDictationButton ?? true}
                        diffRenderMode={diffRenderMode}
                        diffComments={diffComments}
                        diffCommentCount={diffCommentCount}
                        diffCommentsSending={diffCommentsSending}
                        diffCommentError={diffCommentError}
                        onSetDiffBaseline={onSetDiffBaseline}
                        onSetDiffRenderMode={onSetDiffRenderMode}
                        onSendDiffComments={(message) => {
                          void handleSendDiffComments(message);
                        }}
                        onSelectDiffComment={handleSelectDiffComment}
                        promptResetKey={composerPromptResetKey}
                        onLayoutChange={() => setComposerLayoutVersion((current) => current + 1)}
                        mainViewRef={mainViewRef}
                        workspaceFooterRef={footerRef}
                        onOpenTakeoverTerminal={handleShowTakeoverTerminal}
                        onOpenGitOpsView={handleOpenGitOpsView}
                        onOpenSettingsView={() => controller.handleShowView("settings")}
                        onRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
                        onToggleTerminal={handleToggleTerminal}
                        terminalVisible={state.terminalVisible}
                        onListAttachmentEntries={listComposerAttachmentEntries}
                        onAction={handleAction}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "mb-1.5 min-w-0 self-end",
                  state.activeView === "gitops" ? "opacity-100" : "opacity-0 xl:opacity-100",
                )}
              >
                {state.activeView === "gitops" && !state.takeoverVisible ? (
                  <button
                    type="button"
                    className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[rgba(169,178,215,0.1)] hover:text-[color:var(--text)] hover:opacity-100"
                    onClick={toggleGitOpsFileTree}
                    aria-label={gitOpsFileTreeVisible ? "Hide changed files" : "Show changed files"}
                    data-tooltip={
                      gitOpsFileTreeVisible ? "Hide changed files" : "Show changed files"
                    }
                  >
                    <FolderGit2 size={15} />
                  </button>
                ) : state.activeView === "thread" &&
                  !state.takeoverVisible &&
                  !showDesktopTerminalDrawer ? (
                  <DesktopComposerStatus
                    contextUsage={activeComposerState?.contextUsage ?? null}
                    model={activeComposerState?.currentModel ?? null}
                    thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
