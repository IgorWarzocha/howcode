import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AppShellController } from "../../app-shell/useAppShellController";
import { Composer } from "../../components/workspace/Composer";
import { DiffPanel } from "../../components/workspace/DiffPanel";
import { GitOpsComposerPanel } from "../../components/workspace/GitOpsComposerPanel";
import { TerminalPanel } from "../../components/workspace/TerminalPanel";
import { buildDiffCommentPrompt } from "../../components/workspace/diff/diffCommentPrompt";
import {
  type SavedDiffComment,
  diffCommentStore,
  getDiffCommentContextId,
} from "../../components/workspace/diff/diffCommentStore";
import type { ProjectDiffBaseline } from "../../desktop/types";
import { useAnimatedPresence } from "../../hooks/useAnimatedPresence";
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

const WORKSPACE_FOOTER_OVERLAP_PX = 20;
const TERMINAL_DRAWER_WIDTH = "min(28rem, calc(100% - 2.5rem))";
const TERMINAL_DRAWER_OFFSET = TERMINAL_DRAWER_WIDTH;
const TERMINAL_DRAWER_FOOTER_OFFSET = `calc(${TERMINAL_DRAWER_WIDTH} + 1.25rem)`;

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
  const footerContentRef = useRef<HTMLDivElement>(null);
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleCloseGitOpsView,
    handleOpenDiffSelection,
    handleOpenGitOpsView,
    handleOpenWorktreeDiffFile,
    handleShowTakeoverTerminal,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    pickComposerAttachments,
    projectGitState,
    shellState,
    state,
  } = controller;
  const showWorkspaceFooter = state.activeView === "thread" || state.activeView === "gitops";
  const showDiffInMainView = state.activeView === "gitops";
  const desktopTerminalDrawerMounted = state.activeView === "thread" && terminalDrawerVisible;
  const showDesktopTerminalDrawer = desktopTerminalDrawerMounted && !state.takeoverVisible;
  const terminalDrawerPresent = useAnimatedPresence(desktopTerminalDrawerMounted);
  const footerInset = showWorkspaceFooter
    ? Math.max(footerHeight - WORKSPACE_FOOTER_OVERLAP_PX, 0)
    : 0;
  const diffCommentContextId = useMemo(
    () => getDiffCommentContextId({ projectId: composerProjectId }),
    [composerProjectId],
  );

  useLayoutEffect(() => {
    const footerContent = footerContentRef.current;
    if (!showWorkspaceFooter || !footerContent) {
      setFooterHeight(0);
      return;
    }

    const updateFooterHeight = () => {
      const nextHeight = Math.ceil(footerContent.getBoundingClientRect().height);
      setFooterHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateFooterHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateFooterHeight();
    });
    observer.observe(footerContent);

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
      await handleAction("composer.send", {
        text: buildDiffCommentPrompt({ comments: context.comments, instruction: message }),
      });
      diffCommentStore.clearContext(diffCommentContextId);
    } catch (error) {
      setDiffCommentError(
        error instanceof Error ? error.message : "Could not send comments to the agent.",
      );
    } finally {
      setDiffCommentsSending(false);
    }
  };

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden transition-[padding-right] duration-150 ease-out"
      style={showDesktopTerminalDrawer ? { paddingRight: TERMINAL_DRAWER_OFFSET } : undefined}
    >
      <div
        className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden px-5"
        style={footerInset > 0 ? { paddingBottom: `${footerInset}px` } : undefined}
      >
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
                  favoriteFolders: [],
                  projectImportState: null,
                  preferredProjectLocation: null,
                  initializeGitOnProjectCreate: false,
                  useAgentsSkillsPaths: false,
                  piTuiTakeover: false,
                }
              }
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
              onLoadEarlierMessages={handleLoadEarlierMessages}
              onOpenTurnDiff={handleOpenDiffSelection}
              onSetExtensionsProjectScopeActive={controller.handleSetExtensionsProjectScopeActive}
              onSetSkillsProjectScopeActive={controller.handleSetSkillsProjectScopeActive}
              onSelectProject={controller.handleProjectSelect}
            />
          )}
        </main>
      </div>

      {showWorkspaceFooter ? (
        <footer
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-4 transition-[padding-right] duration-150 ease-out"
          style={
            showDesktopTerminalDrawer ? { paddingRight: TERMINAL_DRAWER_FOOTER_OFFSET } : undefined
          }
        >
          <div ref={footerContentRef} className="pointer-events-auto grid gap-2.5">
            <div className={workspaceContentClass}>
              {state.activeView === "gitops" ? (
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
              ) : (
                <Composer
                  activeView={state.activeView}
                  hostLabel={shellState?.availableHosts[0] ?? "Local"}
                  model={activeComposerState?.currentModel ?? null}
                  availableModels={activeComposerState?.availableModels ?? []}
                  thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                  availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ["off"]}
                  projectId={composerProjectId}
                  projectGitState={projectGitState}
                  diffBaseline={diffBaseline}
                  sessionPath={terminalSessionPath}
                  favoriteFolders={shellState?.appSettings.favoriteFolders ?? []}
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
                  onToggleTerminal={handleToggleTerminal}
                  terminalVisible={state.terminalVisible}
                  onPickAttachments={pickComposerAttachments}
                  onListAttachmentEntries={listComposerAttachmentEntries}
                  onAction={handleAction}
                />
              )}
            </div>
          </div>
        </footer>
      ) : null}

      {terminalDrawerPresent ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-20"
          style={{ width: TERMINAL_DRAWER_WIDTH }}
        >
          <div
            data-open={showDesktopTerminalDrawer ? "true" : "false"}
            className={`motion-terminal-drawer h-full ${showDesktopTerminalDrawer ? "pointer-events-auto" : "pointer-events-none"}`}
          >
            <TerminalPanel
              projectId={composerProjectId}
              sessionPath={terminalSessionPath}
              onClose={handleToggleTerminal}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
