import { Bot, GitBranch, Mic, Plus, Send, Square, Terminal } from "lucide-react";
import type { RefObject } from "react";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import { compactCardClass, compactIconButtonClass, iconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { FeatureStatusBadge } from "../../common/FeatureStatusBadge";
import { PiLogoMark } from "../../common/PiLogoMark";
import { ToolbarButton } from "../../common/ToolbarButton";
import type { ComposerProps } from "../Composer";
import { AttachmentChips } from "./AttachmentChips";
import { ComposerDiffBaselineSelector } from "./ComposerDiffBaselineSelector";
import { ComposerFilePicker } from "./ComposerFilePicker";
import { ComposerModelPopover } from "./ComposerModelPopover";
import { ComposerTextField } from "./ComposerTextField";
import { getGitOpsEntryButtonClass } from "./git-ops";
import { useComposerController } from "./useComposerController";

type ComposerPromptSurfaceProps = ComposerProps & {
  composerPanelRef: RefObject<HTMLDivElement | null>;
  onOpenGitOps: () => void;
};

export function ComposerPromptSurface({
  activeView,
  composerPanelRef,
  model,
  availableModels,
  isStreaming,
  thinkingLevel,
  restoredQueuedPrompt,
  streamingBehaviorPreference,
  availableThinkingLevels,
  projectId,
  projectGitState,
  diffBaseline,
  sessionPath,
  favoriteFolders,
  onOpenTakeoverTerminal,
  onToggleTerminal,
  onRestoredQueuedPromptApplied,
  onPickAttachments,
  onListAttachmentEntries,
  onAction,
  terminalVisible,
  onSetDiffBaseline,
  onOpenGitOps,
  onLayoutChange,
}: ComposerPromptSurfaceProps) {
  const gitVisualMode = !projectGitState?.isGitRepo
    ? "not-git"
    : projectGitState.fileCount > 0
      ? "dirty"
      : "clean";
  const {
    attachments,
    canSend,
    clearError,
    draft,
    dictationActive,
    dictationInterimText,
    dictationSupported,
    errorMessage,
    isSending,
    isStreaming: composerIsStreaming,
    pickerButtonRef,
    pickerLoading,
    pickerOpen,
    pickerPanelRef,
    pickerState,
    modelButtonRef,
    modelMenuOpen,
    modelMenuRef,
    pendingPickerAttachments,
    pickAttachments,
    openPickerDirectory,
    openPickerRoot,
    navigatePickerUp,
    removeAttachment,
    runComposerAction,
    send,
    setDraft,
    setOpenMenu,
    stop,
    toggleDictation,
    attachPendingPickerAttachments,
    togglePendingPickerAttachment,
    thinkingLevelLabels,
  } = useComposerController({
    model,
    projectId,
    sessionPath,
    isStreaming,
    restoredQueuedPrompt,
    streamingBehaviorPreference,
    onAction,
    onRestoredQueuedPromptApplied,
    onPickAttachments,
    onListAttachmentEntries,
  });

  const placeholderText =
    activeView === "thread"
      ? "Ask for follow-up changes"
      : "Ask Pi anything, @ to add files, / for commands, $ for skills";

  return (
    <div className="grid min-h-[189px] gap-0">
      {/* Keep this outer min-height in sync with ComposerGitOpsSurface so both composer modes
          swap without vertical jump. */}
      <div className="relative min-h-[148px]">
        {/* The prompt surface intentionally uses one shared top block: +, attachments, placeholder,
            textarea, and dictate/send all live here so we match git-ops height without adding a
            separate control row above or below the prompt. */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
          <button
            ref={pickerButtonRef}
            type="button"
            className={cn(compactIconButtonClass, "shrink-0")}
            onClick={pickAttachments}
            aria-label="Add attachment"
            title="Add attachment"
          >
            <Plus size={16} />
          </button>
          {attachments.length > 0 ? (
            <div className="min-w-0 flex-1">
              <AttachmentChips attachments={attachments} onRemove={removeAttachment} />
            </div>
          ) : null}
        </div>
        {pickerOpen ? (
          <ComposerFilePicker
            currentSelection={pendingPickerAttachments}
            errorMessage={errorMessage}
            favoriteFolders={favoriteFolders}
            loading={pickerLoading}
            picker={pickerState}
            panelRef={pickerPanelRef}
            projectRootPath={projectId}
            onAttachSelected={attachPendingPickerAttachments}
            onNavigateUp={navigatePickerUp}
            onOpenRoot={openPickerRoot}
            onOpenDirectory={openPickerDirectory}
            onToggleFile={togglePendingPickerAttachment}
          />
        ) : null}
        <div className="grid min-h-[148px] content-end px-4 pt-[52px] pb-3">
          <div className="flex min-h-[82px] items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <ComposerTextField
                value={draft}
                onChange={setDraft}
                onInput={() => {
                  if (errorMessage) {
                    clearError();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                ariaLabel="Prompt composer"
                placeholder={placeholderText}
                onHeightChange={onLayoutChange}
              />
            </div>

            <div className="inline-flex h-8 items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  void toggleDictation();
                }}
                className={cn(
                  iconButtonClass,
                  getFeatureStatusButtonClass("feature:composer.dictate"),
                  dictationActive &&
                    "border-[rgba(255,110,110,0.3)] bg-[rgba(255,94,94,0.12)] text-[#ffd1d1]",
                )}
                aria-label={dictationActive ? "Stop dictation" : "Dictate"}
                aria-pressed={dictationActive}
                title={
                  dictationActive
                    ? "Stop dictation"
                    : dictationSupported
                      ? "Dictate"
                      : "Dictation unavailable in this runtime"
                }
              >
                <Mic size={15} />
              </button>
              <button
                type="button"
                className={cn(
                  compactIconButtonClass,
                  "h-6 w-6 shrink-0 rounded-full bg-[rgba(229,111,111,0.18)] text-[#ffb4b4] hover:bg-[rgba(229,111,111,0.28)] hover:text-[#ffd1d1] disabled:cursor-not-allowed disabled:opacity-45",
                )}
                onClick={() => void stop()}
                disabled={!composerIsStreaming || isSending}
                aria-label="Stop Pi"
                title="Stop Pi"
              >
                <Square size={11} fill="currentColor" />
              </button>
              <button
                type="button"
                className={cn(
                  compactIconButtonClass,
                  "h-6 w-6 shrink-0 rounded-full bg-[rgba(146,153,184,0.46)] text-[color:var(--workspace)] hover:bg-[rgba(146,153,184,0.56)] hover:text-[color:var(--workspace)] disabled:cursor-not-allowed disabled:opacity-45",
                )}
                onClick={() => void send()}
                disabled={!canSend}
                aria-label="Send"
                title="Send"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <output className="px-4 pb-2 text-[12px] text-[#f2a7a7]" aria-live="polite">
          {errorMessage}
        </output>
      ) : null}

      {dictationActive || dictationInterimText ? (
        <output className="px-4 pb-2 text-[12px] text-[color:var(--muted)]" aria-live="polite">
          {dictationActive ? "Listening…" : "Dictation stopped."}
          {dictationInterimText ? ` ${dictationInterimText}` : ""}
        </output>
      ) : null}

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      {/* Bottom toolbar should remain structurally aligned with the git-ops footer row. */}
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
        <ToolbarButton
          label="TUI"
          icon={<PiLogoMark className="h-[14px] w-[14px]" />}
          onClick={onOpenTakeoverTerminal}
        />
        <ToolbarButton
          label="Terminal"
          icon={<Terminal size={14} />}
          onClick={onToggleTerminal}
          className={cn(terminalVisible && "bg-[rgba(255,255,255,0.04)] text-[color:var(--text)]")}
        />
        <div className="relative">
          <ToolbarButton
            ref={modelButtonRef}
            label="Agent"
            icon={<Bot size={14} />}
            onClick={() => setOpenMenu((current) => (current === "model" ? null : "model"))}
            aria-haspopup="menu"
            aria-expanded={modelMenuOpen}
            aria-controls="composer-model-menu"
          />
          {modelMenuOpen ? (
            <ComposerModelPopover
              availableModels={availableModels}
              availableThinkingLevels={availableThinkingLevels}
              currentModel={model}
              currentThinkingLevel={thinkingLevel}
              panelRef={modelMenuRef}
              thinkingLevelLabels={thinkingLevelLabels}
              onSelectModel={(availableModel) => {
                void runComposerAction(
                  "composer.model",
                  {
                    provider: availableModel.provider,
                    modelId: availableModel.id,
                    projectId,
                    sessionPath,
                  },
                  { closeMenu: false },
                );
              }}
              onSelectThinkingLevel={(level) => {
                void runComposerAction("composer.thinking", {
                  level,
                  projectId,
                  sessionPath,
                });
              }}
            />
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2 max-md:flex-wrap">
          {projectGitState?.isGitRepo ? (
            <ComposerDiffBaselineSelector
              composerPanelRef={composerPanelRef}
              projectId={projectId}
              projectGitState={projectGitState}
              selectedBaseline={diffBaseline}
              onSelectBaseline={onSetDiffBaseline}
            />
          ) : null}
          {projectGitState?.isGitRepo ? (
            <div
              className={cn(
                compactCardClass,
                "inline-flex max-w-[12rem] px-2.5 py-1 text-[12px] text-[color:var(--muted)]",
              )}
              title={projectGitState.branch ?? "Detached"}
            >
              <span className="truncate">{projectGitState.branch ?? "Detached"}</span>
            </div>
          ) : null}
          <button
            type="button"
            className={cn(compactIconButtonClass, getGitOpsEntryButtonClass(gitVisualMode))}
            onClick={onOpenGitOps}
            aria-label="Open git ops"
            title="Open git ops"
          >
            <GitBranch size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
