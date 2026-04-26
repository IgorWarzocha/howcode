import { useRef, useState } from "react";
import type { AppShellController } from "../../app-shell/useAppShellController";
import { defaultPiSettings } from "../../../../shared/default-pi-settings";
import { Composer } from "../../components/workspace/Composer";
import { DiffPanel } from "../../components/workspace/DiffPanel";
import { GitOpsComposerPanel } from "../../components/workspace/GitOpsComposerPanel";
import { QueuedPromptsCard } from "../../components/workspace/composer/QueuedPromptsCard";
import type { ProjectDiffBaseline } from "../../desktop/types";
import { useDesktopDiff } from "../../hooks/useDesktopDiff";
import { mainPanelClass } from "../../ui/classes";
import { CodeWorkspaceMainView } from "./CodeWorkspaceMainView";
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
  terminalDrawerVisible: boolean;
  terminalSessionPath: string | null;
  workspaceContentClass: string;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
};

const TERMINAL_DRAWER_OFFSET = "min(28rem, calc(100% - 2.5rem))";
const TERMINAL_DRAWER_FOOTER_OFFSET = `calc(${TERMINAL_DRAWER_OFFSET} + 1.25rem)`;

export function CodeWorkspaceView({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffBaseline,
  terminalDrawerVisible,
  terminalSessionPath,
  workspaceContentClass,
  onSetDiffBaseline,
}: CodeWorkspaceViewProps) {
  const [composerPromptResetKey, setComposerPromptResetKey] = useState(0);
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0);
  const [diffRenderMode, setDiffRenderMode] = useState<"stacked" | "split">("stacked");
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
  const showDiffInMainView = state.activeView === "gitops";
  const showDesktopTerminalDrawer = state.activeView === "thread" && terminalDrawerVisible;
  const { error: diffLoadError } = useDesktopDiff(
    composerProjectId,
    diffBaseline,
    showDiffInMainView && (projectGitState?.isGitRepo ?? false),
  );
  const footerHeight = useWorkspaceFooterHeight({
    footerRef,
    visible: showWorkspaceFooter,
  });
  const footerInset = showWorkspaceFooter ? footerHeight : 0;
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

  const terminalDrawerPaddingStyle = showDesktopTerminalDrawer
    ? { paddingRight: TERMINAL_DRAWER_OFFSET }
    : undefined;
  const terminalDrawerFooterPaddingStyle = showDesktopTerminalDrawer
    ? { paddingRight: TERMINAL_DRAWER_FOOTER_OFFSET }
    : undefined;

  return (
    <div
      className="motion-terminal-drawer-offset relative min-h-0 flex-1 overflow-hidden"
      style={terminalDrawerPaddingStyle}
    >
      <div
        className="absolute inset-x-0 top-0 overflow-hidden px-5"
        style={{ bottom: `${footerInset}px` }}
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
              />
            ) : (
              <CodeWorkspaceMainView
                activeView={state.activeView}
                appSettings={
                  shellState?.appSettings ?? {
                    gitCommitMessageModel: null,
                    skillCreatorModel: null,
                    composerStreamingBehavior: "followUp",
                    dictationModelId: null,
                    dictationMaxDurationSeconds: 180,
                    showDictationButton: true,
                    favoriteFolders: [],
                    projectImportState: null,
                    preferredProjectLocation: null,
                    initializeGitOnProjectCreate: false,
                    projectDeletionMode: "pi-only",
                    useAgentsSkillsPaths: false,
                    piTuiTakeover: false,
                  }
                }
                piSettings={shellState?.piSettings ?? defaultPiSettings}
                archivedThreads={controller.archivedThreads}
                availableModels={activeComposerState?.availableModels ?? []}
                currentModel={activeComposerState?.currentModel ?? null}
                currentProjectName={currentProjectName}
                selectedInboxThread={controller.selectedInboxThread}
                projects={controller.projects}
                selectedProjectId={controller.state.selectedProjectId}
                workspaceContentClass={workspaceContentClass}
                threadData={activeThreadData}
                composerLayoutVersion={composerLayoutVersion}
                onAction={handleAction}
                onDismissInboxThread={controller.handleDismissInboxThread}
                onOpenThread={controller.handleThreadOpen}
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
          className="motion-terminal-drawer-offset pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-4"
          style={terminalDrawerFooterPaddingStyle}
        >
          <div className="pointer-events-auto grid gap-2.5">
            <div className={workspaceContentClass}>
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
                    diffBaseline={diffBaseline}
                    diffRenderMode={diffRenderMode}
                    diffComments={diffComments}
                    diffCommentCount={diffCommentCount}
                    diffCommentsSending={diffCommentsSending}
                    diffCommentError={diffCommentError}
                    diffLoadError={diffLoadError}
                    onSetDiffBaseline={onSetDiffBaseline}
                    onSetDiffRenderMode={setDiffRenderMode}
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
                      hostLabel={shellState?.availableHosts[0] ?? "Local"}
                      model={activeComposerState?.currentModel ?? null}
                      contextUsage={activeComposerState?.contextUsage ?? null}
                      availableModels={activeComposerState?.availableModels ?? []}
                      isStreaming={activeThreadData?.isStreaming ?? false}
                      isCompacting={activeComposerState?.isCompacting ?? false}
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
                      onSetDiffRenderMode={setDiffRenderMode}
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
          </div>
        </footer>
      ) : null}
    </div>
  );
}
