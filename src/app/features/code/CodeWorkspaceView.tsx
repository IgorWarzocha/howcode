import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AppShellController } from "../../app-shell/useAppShellController";
import { getDesktopActionErrorMessage } from "../../desktop/action-results";
import { Composer } from "../../components/workspace/Composer";
import { DiffPanel } from "../../components/workspace/DiffPanel";
import { GitOpsComposerPanel } from "../../components/workspace/GitOpsComposerPanel";
import { QueuedPromptsCard } from "../../components/workspace/composer/QueuedPromptsCard";
import { buildDiffCommentPrompt } from "../../components/workspace/diff/diffCommentPrompt";
import {
  type SavedDiffComment,
  diffCommentStore,
  getDiffCommentContextId,
} from "../../components/workspace/diff/diffCommentStore";
import type { ComposerQueuedPrompt, ProjectDiffBaseline } from "../../desktop/types";
import { mainPanelClass } from "../../ui/classes";
import { CodeWorkspaceMainView } from "./CodeWorkspaceMainView";

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

type RestoredQueuedPromptState = {
  projectId: string;
  sessionPath: string | null;
  text: string;
};

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
  const [footerHeight, setFooterHeight] = useState(0);
  const [diffRenderMode, setDiffRenderMode] = useState<"stacked" | "split">("stacked");
  const [diffComments, setDiffComments] = useState<SavedDiffComment[]>([]);
  const [diffCommentCount, setDiffCommentCount] = useState(0);
  const [selectedDiffCommentId, setSelectedDiffCommentId] = useState<string | null>(null);
  const [selectedDiffCommentJumpKey, setSelectedDiffCommentJumpKey] = useState(0);
  const [diffCommentsSending, setDiffCommentsSending] = useState(false);
  const [diffCommentError, setDiffCommentError] = useState<string | null>(null);
  const [restoredQueuedPrompt, setRestoredQueuedPrompt] =
    useState<RestoredQueuedPromptState | null>(null);
  const [pendingQueuedPromptIds, setPendingQueuedPromptIds] = useState<string[]>([]);
  const pendingQueuedPromptIdsRef = useRef(new Set<string>());
  const footerRef = useRef<HTMLElement>(null);
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
  const footerInset = showWorkspaceFooter ? footerHeight : 0;
  const pendingQueueScopeKey = `${composerProjectId}:${terminalSessionPath ?? ""}`;
  const pendingQueueScopePrefix = `${pendingQueueScopeKey}:`;
  const diffCommentContextId = useMemo(
    () => getDiffCommentContextId({ projectId: composerProjectId }),
    [composerProjectId],
  );
  const pendingQueuedPromptIdsForSession = useMemo(
    () =>
      pendingQueuedPromptIds.flatMap((pendingKey) =>
        pendingKey.startsWith(pendingQueueScopePrefix)
          ? [pendingKey.slice(pendingQueueScopePrefix.length)]
          : [],
      ),
    [pendingQueueScopePrefix, pendingQueuedPromptIds],
  );

  const scopedRestoredQueuedPrompt =
    restoredQueuedPrompt?.projectId === composerProjectId &&
    restoredQueuedPrompt.sessionPath === terminalSessionPath
      ? restoredQueuedPrompt.text
      : null;

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!showWorkspaceFooter || !footer) {
      setFooterHeight(0);
      return;
    }

    const updateFooterHeight = () => {
      const nextHeight = Math.ceil(footer.getBoundingClientRect().height);
      setFooterHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateFooterHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateFooterHeight();
    });
    observer.observe(footer);

    return () => {
      observer.disconnect();
    };
  }, [showWorkspaceFooter]);

  useEffect(() => {
    const syncCommentCount = () => {
      if (!diffCommentContextId) {
        setDiffComments([]);
        setDiffCommentCount(0);
        return;
      }

      const nextComments = diffCommentStore.getContext(diffCommentContextId)?.comments ?? [];
      setDiffComments(nextComments);
      setDiffCommentCount(nextComments.length);
    };

    setSelectedDiffCommentId(null);
    setSelectedDiffCommentJumpKey(0);
    syncCommentCount();
    return diffCommentStore.subscribe(syncCommentCount);
  }, [diffCommentContextId]);

  const handleSendDiffComments = async (message?: string | null) => {
    if (!diffCommentContextId || diffCommentsSending) {
      return;
    }

    const context = diffCommentStore.getContext(diffCommentContextId);
    if (!context || context.comments.length === 0) {
      return;
    }

    setDiffCommentsSending(true);
    setDiffCommentError(null);
    setSelectedDiffCommentId(null);
    setComposerPromptResetKey((current) => current + 1);

    try {
      const streamingBehaviorPreference =
        shellState?.appSettings.composerStreamingBehavior ?? "followUp";
      const result = await handleAction("composer.send", {
        text: buildDiffCommentPrompt({ comments: context.comments, instruction: message }),
        streamingBehavior: streamingBehaviorPreference,
      });

      const actionErrorMessage = getDesktopActionErrorMessage(
        result,
        "Could not send comments to the agent.",
      );
      if (actionErrorMessage) {
        setDiffCommentError(actionErrorMessage);
        return;
      }

      if (result?.result?.composerSendOutcome === "stopped") {
        return;
      }

      diffCommentStore.clearContext(diffCommentContextId);
    } catch (error) {
      setDiffCommentError(
        error instanceof Error ? error.message : "Could not send comments to the agent.",
      );
    } finally {
      setDiffCommentsSending(false);
    }
  };

  const handleEditQueuedPrompt = async (prompt: ComposerQueuedPrompt) => {
    const pendingKey = `${pendingQueueScopeKey}:${prompt.id}`;

    if (pendingQueuedPromptIdsRef.current.has(pendingKey)) {
      return;
    }

    pendingQueuedPromptIdsRef.current.add(pendingKey);
    setPendingQueuedPromptIds((current) => [...current, pendingKey]);

    try {
      const result = await handleAction("composer.dequeue", {
        projectId: composerProjectId,
        sessionPath: terminalSessionPath,
        queueId: prompt.id,
        queueSnapshotKey: prompt.queueSnapshotKey,
        queueMode: prompt.mode,
      });

      if (typeof result?.result?.dequeuedText === "string") {
        setRestoredQueuedPrompt({
          projectId: composerProjectId,
          sessionPath: terminalSessionPath,
          text: result.result.dequeuedText,
        });
      }
    } finally {
      pendingQueuedPromptIdsRef.current.delete(pendingKey);
      setPendingQueuedPromptIds((current) => current.filter((id) => id !== pendingKey));
    }
  };

  const handleRemoveQueuedPrompt = async (prompt: ComposerQueuedPrompt) => {
    const pendingKey = `${pendingQueueScopeKey}:${prompt.id}`;

    if (pendingQueuedPromptIdsRef.current.has(pendingKey)) {
      return;
    }

    pendingQueuedPromptIdsRef.current.add(pendingKey);
    setPendingQueuedPromptIds((current) => [...current, pendingKey]);

    try {
      await handleAction("composer.dequeue", {
        projectId: composerProjectId,
        sessionPath: terminalSessionPath,
        queueId: prompt.id,
        queueSnapshotKey: prompt.queueSnapshotKey,
        queueMode: prompt.mode,
      });
    } finally {
      pendingQueuedPromptIdsRef.current.delete(pendingKey);
      setPendingQueuedPromptIds((current) => current.filter((id) => id !== pendingKey));
    }
  };

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
                    projectGitState={projectGitState}
                    diffBaseline={diffBaseline}
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
                    onSelectDiffComment={(filePath, commentId) => {
                      setSelectedDiffCommentId(commentId);
                      setSelectedDiffCommentJumpKey((current) => current + 1);
                      handleOpenWorktreeDiffFile(filePath);
                    }}
                    onLayoutChange={() => setComposerLayoutVersion((current) => current + 1)}
                    onAction={handleAction}
                    onBack={handleCloseGitOpsView}
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
                      availableModels={activeComposerState?.availableModels ?? []}
                      isStreaming={activeThreadData?.isStreaming ?? false}
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
                      onSelectDiffComment={(filePath, commentId) => {
                        setSelectedDiffCommentId(commentId);
                        setSelectedDiffCommentJumpKey((current) => current + 1);
                        handleOpenWorktreeDiffFile(filePath);
                      }}
                      promptResetKey={composerPromptResetKey}
                      onLayoutChange={() => setComposerLayoutVersion((current) => current + 1)}
                      onOpenTakeoverTerminal={handleShowTakeoverTerminal}
                      onOpenGitOpsView={handleOpenGitOpsView}
                      onOpenSettingsView={() => controller.handleShowView("settings")}
                      onRestoredQueuedPromptApplied={() => {
                        setRestoredQueuedPrompt((current) =>
                          current?.projectId === composerProjectId &&
                          current.sessionPath === terminalSessionPath
                            ? null
                            : current,
                        );
                      }}
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
