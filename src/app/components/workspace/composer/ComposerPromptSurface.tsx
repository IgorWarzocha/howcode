import { Plus, Send, Square } from "lucide-react";
import { type RefObject, useEffect } from "react";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import type { ComposerProps } from "../Composer";
import { AttachmentChips } from "./AttachmentChips";
import { ComposerDictationControls } from "./ComposerDictationControls";
import { ComposerFooter } from "./ComposerFooter";
import { ComposerFilePicker } from "./ComposerFilePicker";
import { ComposerTextField } from "./ComposerTextField";
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
  dictationModelId,
  favoriteFolders,
  showDictationButton,
  onOpenTakeoverTerminal,
  onToggleTerminal,
  onOpenSettingsView,
  onRestoredQueuedPromptApplied,
  onListAttachmentEntries,
  onAction,
  terminalVisible,
  onSetDiffBaseline,
  onOpenGitOps,
  onLayoutChange,
}: ComposerPromptSurfaceProps) {
  const {
    attachments,
    cancelDictation,
    canSend,
    clearError,
    draft,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
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
    dictationModelId,
    isStreaming,
    restoredQueuedPrompt,
    streamingBehaviorPreference,
    onAction,
    onRestoredQueuedPromptApplied,
    onListAttachmentEntries,
  });
  const dictationTranscribing = dictationInterimText.length > 0;

  useEffect(() => {
    if (!dictationActive && !dictationTranscribing) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      (document.activeElement as HTMLElement | null)?.blur?.();
      void cancelDictation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [cancelDictation, dictationActive, dictationTranscribing]);

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
                  if (event.key === "Escape" && (dictationActive || dictationTranscribing)) {
                    event.preventDefault();
                    void cancelDictation();
                    return;
                  }

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
              <ComposerDictationControls
                dictationActive={dictationActive}
                dictationMissingModel={dictationMissingModel}
                dictationSupported={dictationSupported}
                dictationTranscribing={dictationTranscribing}
                onAction={onAction}
                onOpenSettingsView={onOpenSettingsView}
                showDictationButton={showDictationButton}
                toggleDictation={toggleDictation}
              />
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

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      <ComposerFooter
        availableModels={availableModels}
        availableThinkingLevels={availableThinkingLevels}
        composerPanelRef={composerPanelRef}
        diffBaseline={diffBaseline}
        model={model}
        modelButtonRef={modelButtonRef}
        modelMenuOpen={modelMenuOpen}
        modelMenuRef={modelMenuRef}
        onOpenGitOps={onOpenGitOps}
        onOpenTakeoverTerminal={onOpenTakeoverTerminal}
        onSelectBaseline={onSetDiffBaseline}
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
        onSetOpenMenu={setOpenMenu}
        onToggleTerminal={onToggleTerminal}
        projectGitState={projectGitState}
        projectId={projectId}
        terminalVisible={terminalVisible}
        thinkingLevel={thinkingLevel}
        thinkingLevelLabels={thinkingLevelLabels}
      />
    </div>
  );
}
