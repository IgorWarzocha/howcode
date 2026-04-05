import { useEffect, useMemo, useState } from "react";
import { Composer } from "../components/workspace/Composer";
import { DiffPanel } from "../components/workspace/DiffPanel";
import { TerminalPanel } from "../components/workspace/TerminalPanel";
import { buildDiffCommentPrompt } from "../components/workspace/diff/diffCommentPrompt";
import {
  type SavedDiffComment,
  diffCommentStore,
  getDiffCommentContextId,
} from "../components/workspace/diff/diffCommentStore";
import { mainPanelClass } from "../ui/classes";
import { MainView } from "../views/MainView";
import type { AppShellController } from "./useAppShellController";

type AppShellWorkspaceProps = {
  controller: AppShellController;
  activeComposerState: AppShellController["activeComposerState"];
  activeThreadData: AppShellController["activeThreadData"];
  composerProjectId: string;
  currentProjectName: string;
  dockedTerminalVisible: boolean;
  terminalSessionPath: string | null;
  workspaceContentClass: string;
};

export function AppShellWorkspace({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  dockedTerminalVisible,
  terminalSessionPath,
  workspaceContentClass,
}: AppShellWorkspaceProps) {
  const [composerPromptResetKey, setComposerPromptResetKey] = useState(0);
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0);
  const [diffRenderMode, setDiffRenderMode] = useState<"stacked" | "split">("stacked");
  const [diffComments, setDiffComments] = useState<SavedDiffComment[]>([]);
  const [diffCommentCount, setDiffCommentCount] = useState(0);
  const [selectedDiffCommentId, setSelectedDiffCommentId] = useState<string | null>(null);
  const [selectedDiffCommentJumpKey, setSelectedDiffCommentJumpKey] = useState(0);
  const [diffCommentsSending, setDiffCommentsSending] = useState(false);
  const [diffCommentError, setDiffCommentError] = useState<string | null>(null);
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleOpenDiffSelection,
    handleOpenWorktreeDiffFile,
    handleShowTakeoverTerminal,
    handleToggleDiff,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    pickComposerAttachments,
    projectGitState,
    shellState,
    state,
  } = controller;
  const showWorkspaceFooter = state.activeView !== "settings";
  const showDiffInMainView = state.diffVisible && showWorkspaceFooter;
  const diffCommentContextId = useMemo(
    () => getDiffCommentContextId({ projectId: composerProjectId }),
    [composerProjectId],
  );

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
    <>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden px-5">
        <main
          className={
            state.activeView === "thread" || showDiffInMainView
              ? "mb-5 min-h-0 overflow-hidden pt-1.5"
              : mainPanelClass
          }
        >
          {showDiffInMainView ? (
            <DiffPanel
              projectId={composerProjectId}
              isGitRepo={projectGitState?.isGitRepo ?? false}
              selectedFilePath={state.selectedDiffFilePath}
              selectedCommentId={selectedDiffCommentId}
              selectedCommentJumpKey={selectedDiffCommentJumpKey}
              diffRenderMode={diffRenderMode}
              layoutMode="main"
            />
          ) : (
            <MainView
              activeView={state.activeView}
              appSettings={
                shellState?.appSettings ?? { gitCommitMessageModel: null, favoriteFolders: [] }
              }
              availableModels={activeComposerState?.availableModels ?? []}
              currentModel={activeComposerState?.currentModel ?? null}
              currentProjectName={currentProjectName}
              threadData={activeThreadData}
              composerLayoutVersion={composerLayoutVersion}
              onAction={(action, payload) => void handleAction(action, payload)}
              onLoadEarlierMessages={handleLoadEarlierMessages}
              onOpenTurnDiff={handleOpenDiffSelection}
            />
          )}
        </main>
      </div>

      {showWorkspaceFooter ? (
        <footer className="relative z-10 -mt-5 shrink-0 grid gap-2.5 px-5 pt-0 pb-4">
          <div className="grid gap-2.5">
            <div className={workspaceContentClass}>
              <Composer
                activeView={state.activeView}
                hostLabel={shellState?.availableHosts[0] ?? "Local"}
                model={activeComposerState?.currentModel ?? null}
                availableModels={activeComposerState?.availableModels ?? []}
                thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ["off"]}
                projectId={composerProjectId}
                projectGitState={projectGitState}
                sessionPath={terminalSessionPath}
                favoriteFolders={shellState?.appSettings.favoriteFolders ?? []}
                onSetDiffPanelVisible={(visible) => {
                  if (visible === state.diffVisible) {
                    return;
                  }

                  handleToggleDiff();
                }}
                diffRenderMode={diffRenderMode}
                diffComments={diffComments}
                diffCommentCount={diffCommentCount}
                diffCommentsSending={diffCommentsSending}
                diffCommentError={diffCommentError}
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
                onToggleTerminal={handleToggleTerminal}
                terminalVisible={state.terminalVisible}
                onPickAttachments={pickComposerAttachments}
                onListAttachmentEntries={listComposerAttachmentEntries}
                onAction={handleAction}
              />
            </div>
            {dockedTerminalVisible ? (
              <div className={workspaceContentClass}>
                <TerminalPanel
                  projectId={composerProjectId}
                  sessionPath={terminalSessionPath}
                  onClose={handleToggleTerminal}
                  mode="docked"
                  onAction={(action, payload) => void handleAction(action, payload)}
                />
              </div>
            ) : null}
          </div>
        </footer>
      ) : null}
    </>
  );
}
