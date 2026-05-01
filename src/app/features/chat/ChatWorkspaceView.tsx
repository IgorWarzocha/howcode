import { useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  getLocalDraftChatGroupId,
  getPersistedSessionPath,
} from "../../../../shared/session-paths";
import type { AppShellController } from "../../app-shell/useAppShellController";
import { Composer } from "../../components/workspace/Composer";
import { QueuedPromptsCard } from "../../components/workspace/composer/QueuedPromptsCard";
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from "../../desktop/types";
import type { Message } from "../../types";
import { cn } from "../../utils/cn";
import { ChatView } from "./ChatView";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import { DesktopComposerStatus } from "../code/DesktopComposerStatus";
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
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

const ARTIFACT_DRAWER_WIDTH = "min(760px, max(0px, calc(100% - 900px)))";

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
  sidebarCollapsed,
  onToggleSidebar,
}: ChatWorkspaceViewProps) {
  const [composerPromptResetKey] = useState(0);
  const [composerLayoutVersion, setComposerLayoutVersion] = useState(0);
  const [artifactsVisibleByConversation, setArtifactsVisibleByConversation] = useState<
    Record<string, boolean>
  >({});
  const [artifactsFullscreen, setArtifactsFullscreen] = useState(false);
  const footerRef = useRef<HTMLElement>(null);
  const mainViewRef = useRef<HTMLElement>(null);
  const {
    handleAction,
    handleLoadEarlierMessages,
    handleShowTakeoverTerminal,
    handleToggleTerminal,
    listComposerAttachmentEntries,
    shellState,
    state,
  } = controller;
  const footerHeight = useWorkspaceFooterHeight({ footerRef, visible: true });
  const conversationId = activeThreadData?.sessionPath ?? terminalSessionPath;
  const hasConversation = (activeThreadData?.messages.length ?? 0) > 0;
  const hasPersistedChatSession = getPersistedSessionPath(terminalSessionPath) !== null;
  const draftChatGroupId = getLocalDraftChatGroupId(terminalSessionPath);
  const artifactsVisible = conversationId
    ? (artifactsVisibleByConversation[conversationId] ?? false)
    : false;
  const artifactDrawerInsetStyle = artifactsVisible ? { right: ARTIFACT_DRAWER_WIDTH } : undefined;
  const [conversationContentVisible, setConversationContentVisible] = useState(hasConversation);
  const previousHasConversationRef = useRef(hasConversation);
  const previousConversationIdRef = useRef<string | null | undefined>(conversationId);

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

  useEffect(() => {
    if (!window.piDesktop?.subscribe) return;
    if (!conversationId) return;
    return window.piDesktop.subscribe((event) => {
      if (event.type !== "artifact-update") return;
      if (event.conversationId !== conversationId) return;
      setArtifactsVisibleByConversation((current) => ({
        ...current,
        [conversationId]: true,
      }));
    });
  }, [conversationId]);

  if (previousConversationIdRef.current !== conversationId) {
    previousConversationIdRef.current = conversationId;
    if (artifactsFullscreen) setArtifactsFullscreen(false);
  }

  useEffect(() => {
    if (!artifactsVisible) setArtifactsFullscreen(false);
  }, [artifactsVisible]);
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
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 min-h-0 overflow-hidden transition-[right] duration-200 ease-out",
          artifactsFullscreen && "hidden",
        )}
        style={!artifactsFullscreen ? artifactDrawerInsetStyle : undefined}
      >
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
            "pointer-events-none absolute inset-x-0 z-10 px-5 pb-4",
            hasConversation
              ? "bottom-0 translate-y-0"
              : "top-1/2 -translate-y-1/2 transition-[top,transform] duration-300 ease-out",
          )}
        >
          <div className="pointer-events-auto grid gap-2.5">
            <div className="grid grid-cols-[minmax(0,1fr)_800px_minmax(0,1fr)] items-end gap-3">
              <div
                className={cn(
                  "mb-1.5 min-w-0 self-end opacity-0 xl:opacity-100",
                  artifactsVisible && !artifactsFullscreen && "invisible",
                )}
              >
                <button
                  type="button"
                  className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[rgba(169,178,215,0.1)] hover:text-[color:var(--text)] hover:opacity-100"
                  onClick={onToggleSidebar}
                  aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                  data-tooltip={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
                </button>
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
                  chatGroupId={
                    hasPersistedChatSession
                      ? null
                      : (draftChatGroupId ?? controller.selectedChatGroupId)
                  }
                  projectGitState={null}
                  diffBaseline={diffBaseline}
                  sessionPath={terminalSessionPath}
                  dictationModelId={shellState?.appSettings.dictationModelId ?? null}
                  dictationMaxDurationSeconds={
                    shellState?.appSettings.dictationMaxDurationSeconds ?? 180
                  }
                  favoriteFolders={shellState?.appSettings.favoriteFolders ?? []}
                  showDictationButton={shellState?.appSettings.showDictationButton ?? true}
                  diffRenderMode={diffRenderMode}
                  diffComments={[]}
                  diffCommentCount={0}
                  diffCommentsSending={false}
                  diffCommentError={null}
                  onSetDiffBaseline={onSetDiffBaseline}
                  onSetDiffRenderMode={onSetDiffRenderMode}
                  onSendDiffComments={() => {}}
                  onSelectDiffComment={() => {}}
                  promptResetKey={composerPromptResetKey}
                  onLayoutChange={() => setComposerLayoutVersion((current) => current + 1)}
                  mainViewRef={mainViewRef}
                  workspaceFooterRef={footerRef}
                  onOpenTakeoverTerminal={handleShowTakeoverTerminal}
                  onOpenGitOpsView={() => {}}
                  onOpenSettingsView={() => controller.handleShowView("settings")}
                  onRestoredQueuedPromptApplied={markRestoredQueuedPromptApplied}
                  onToggleTerminal={handleToggleTerminal}
                  onToggleArtifacts={
                    hasConversation && conversationId
                      ? () =>
                          setArtifactsVisibleByConversation((current) => ({
                            ...current,
                            [conversationId]: !(current[conversationId] ?? false),
                          }))
                      : undefined
                  }
                  artifactsAvailable={hasConversation}
                  showTerminalControls={false}
                  artifactsVisible={artifactsVisible}
                  terminalVisible={state.terminalVisible}
                  onListAttachmentEntries={listComposerAttachmentEntries}
                  onAction={handleAction}
                />
              </div>
              <div
                className={cn(
                  "mb-1.5 min-w-0 self-end opacity-0 xl:opacity-100",
                  artifactsVisible && !artifactsFullscreen && "invisible",
                )}
              >
                <DesktopComposerStatus
                  contextUsage={activeComposerState?.contextUsage ?? null}
                  model={activeComposerState?.currentModel ?? null}
                  thinkingLevel={activeComposerState?.currentThinkingLevel ?? "off"}
                />
              </div>
            </div>
          </div>
        </footer>
      </div>
      <div
        className={cn(
          "absolute top-0 right-0 bottom-0 min-h-0 overflow-hidden transition-[width] duration-200 ease-out",
          !artifactsVisible && "w-0",
          artifactsFullscreen && "left-0 w-auto",
        )}
        style={
          artifactsVisible && !artifactsFullscreen ? { width: ARTIFACT_DRAWER_WIDTH } : undefined
        }
      >
        <ArtifactPanel
          conversationId={conversationId}
          visible={artifactsVisible}
          fullscreen={artifactsFullscreen}
          onToggleFullscreen={() => setArtifactsFullscreen((fullscreen) => !fullscreen)}
          onClose={() => {
            if (conversationId) {
              setArtifactsVisibleByConversation((current) => ({
                ...current,
                [conversationId]: false,
              }));
            }
            setArtifactsFullscreen(false);
          }}
        />
      </div>
    </div>
  );
}
