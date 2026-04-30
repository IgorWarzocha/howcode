import { useEffect, useRef, useState } from "react";
import type { AppShellController } from "../../app-shell/useAppShellController";
import { Composer } from "../../components/workspace/Composer";
import { QueuedPromptsCard } from "../../components/workspace/composer/QueuedPromptsCard";
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from "../../desktop/types";
import type { Message } from "../../types";
import { cn } from "../../utils/cn";
import { ChatView } from "./ChatView";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import { DesktopComposerStatus } from "../code/DesktopComposerStatus";
import { useDiffCommentController } from "../code/useDiffCommentController";
import { useQueuedPromptRestore } from "../code/useQueuedPromptRestore";
import { useWorkspaceFooterHeight } from "../code/useWorkspaceFooterHeight";

type ChatWorkspaceViewProps = {
  controller: AppShellController;
  activeComposerState: AppShellController["activeComposerState"];
  activeThreadData: AppShellController["activeThreadData"];
  composerProjectId: string;
  diffBaseline: ProjectDiffBaseline;
  diffRenderMode: ProjectDiffRenderMode;
  terminalSessionPath: string | null;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void;
};

function getReplyActivityKey(messages: readonly Message[]) {
  return messages
    .filter((message) => message.role !== "user")
    .map((message) => message.id)
    .join("|");
}

export function ChatWorkspaceView({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  diffBaseline,
  diffRenderMode,
  terminalSessionPath,
  onSetDiffBaseline,
  onSetDiffRenderMode,
}: ChatWorkspaceViewProps) {
  const [composerPromptResetKey, setComposerPromptResetKey] = useState(0);
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0);
  const footerRef = useRef<HTMLElement>(null);
  const mainViewRef = useRef<HTMLElement>(null);
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleOpenGitOpsView,
    handleOpenWorktreeDiffFile,
    handleShowTakeoverTerminal,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    projectGitState,
    shellState,
    state,
  } = controller;
  const footerHeight = useWorkspaceFooterHeight({ footerRef, visible: true });
  const hasConversation = (activeThreadData?.messages.length ?? 0) > 0;
  const [conversationContentVisible, setConversationContentVisible] = useState(hasConversation);
  const previousHasConversationRef = useRef(hasConversation);

  useEffect(() => {
    if (!hasConversation) {
      previousHasConversationRef.current = false;
      setConversationContentVisible(false);
      return;
    }

    if (previousHasConversationRef.current) {
      setConversationContentVisible(true);
      return;
    }

    previousHasConversationRef.current = true;
    const timeout = window.setTimeout(() => setConversationContentVisible(true), 300);
    return () => window.clearTimeout(timeout);
  }, [hasConversation]);
  const {
    diffCommentCount,
    diffCommentError,
    diffComments,
    diffCommentsSending,
    handleSelectDiffComment,
    handleSendDiffComments,
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

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 overflow-hidden px-5"
          style={{ bottom: hasConversation ? `${footerHeight}px` : "0px" }}
        >
          <main ref={mainViewRef} className="h-full min-h-0 overflow-hidden pt-1.5">
            <ChatView
              key={activeThreadData?.sessionPath ?? "new-chat"}
              messages={conversationContentVisible ? (activeThreadData?.messages ?? []) : []}
              previousMessageCount={activeThreadData?.previousMessageCount ?? 0}
              isStreaming={activeThreadData?.isStreaming ?? false}
              isCompacting={activeThreadData?.isCompacting ?? false}
              composerLayoutVersion={composerLayoutVersion}
              onLoadEarlierMessages={handleLoadEarlierMessages}
            />
          </main>
        </div>

        <footer
          ref={footerRef}
          className={cn(
            "pointer-events-none absolute inset-x-0 z-10 px-5 transition-[top,transform,padding] duration-300 ease-out",
            hasConversation ? "translate-y-0 pb-4" : "-translate-y-1/2 pb-4",
          )}
          style={{ top: hasConversation ? `calc(100% - ${footerHeight}px)` : "50%" }}
        >
          <div className="pointer-events-auto grid gap-2.5">
            <div className="grid grid-cols-[minmax(0,1fr)_800px_minmax(0,1fr)] items-center gap-3">
              <div className="min-w-0 self-center opacity-0 xl:opacity-100">
                <DesktopComposerStatus
                  contextUsage={activeComposerState?.contextUsage ?? null}
                  model={activeComposerState?.currentModel ?? null}
                  thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                />
              </div>
              <div className="grid w-[800px] gap-0">
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
                  availableThinkingLevels={activeComposerState?.availableThinkingLevels ?? ["off"]}
                  projectId={composerProjectId}
                  chatGroupId={controller.selectedChatGroupId}
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
                  showTerminalControls={false}
                  terminalVisible={state.terminalVisible}
                  onListAttachmentEntries={listComposerAttachmentEntries}
                  onAction={handleAction}
                />
              </div>
              <div aria-hidden="true" />
            </div>
          </div>
        </footer>
      </div>
      <ArtifactPanel conversationId={activeThreadData?.sessionPath ?? terminalSessionPath} />
    </div>
  );
}
