import { Paperclip, Send, Square, X } from "lucide-react";
import { type ClipboardEvent, type RefObject, useEffect } from "react";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import type { ComposerProps } from "../Composer";
import { ComposerDictationControls } from "./ComposerDictationControls";
import { ComposerFooter } from "./ComposerFooter";
import { ComposerFilePicker } from "./ComposerFilePicker";
import { ComposerTextField } from "./ComposerTextField";
import { hasFilePayloadInClipboardData } from "./composer-paste-attachments";
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
  dictationMaxDurationSeconds,
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
    clearAttachments,
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
    removeAttachment,
    runComposerAction,
    send,
    setDraft,
    setOpenMenu,
    stop,
    toggleDictation,
    attachPickerAttachments,
    handleDrop,
    togglePendingPickerAttachment,
    handlePaste,
    thinkingLevelLabels,
  } = useComposerController({
    activeView,
    model,
    projectId,
    sessionPath,
    dictationModelId,
    dictationMaxDurationSeconds,
    isStreaming,
    restoredQueuedPrompt,
    streamingBehaviorPreference,
    onAction,
    onRestoredQueuedPromptApplied,
    onListAttachmentEntries,
  });
  const dictationTranscribing = dictationInterimText.length > 0;

  useEffect(() => {
    if (!pickerOpen && !dictationActive && !dictationTranscribing) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (pickerOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpenMenu(null);
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
  }, [cancelDictation, dictationActive, dictationTranscribing, pickerOpen, setOpenMenu]);

  useEffect(() => {
    const composerPanel = composerPanelRef.current;
    if (!composerPanel) {
      return;
    }

    const handleComposerFileDrag = (event: DragEvent) => {
      if (!hasFilePayloadInClipboardData(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const handleComposerDrop = (event: DragEvent) => {
      if (!hasFilePayloadInClipboardData(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      handleDrop(event.dataTransfer);
    };

    composerPanel.addEventListener("dragenter", handleComposerFileDrag, true);
    composerPanel.addEventListener("dragover", handleComposerFileDrag, true);
    composerPanel.addEventListener("drop", handleComposerDrop, true);

    return () => {
      composerPanel.removeEventListener("dragenter", handleComposerFileDrag, true);
      composerPanel.removeEventListener("dragover", handleComposerFileDrag, true);
      composerPanel.removeEventListener("drop", handleComposerDrop, true);
    };
  }, [composerPanelRef, handleDrop]);

  const placeholderText =
    activeView === "thread"
      ? "Ask for follow-up changes"
      : "Ask Pi anything, @ to add files, / for commands, $ for skills";
  const attachmentButtonLabel = attachments.length > 0 ? "Manage attachments" : "Add attachment";

  return (
    <div className="grid gap-0">
      {/* Let the prompt column size itself to one line by default, then grow upward naturally as
          the textarea expands. */}
      <div className="relative">
        {/* The prompt surface keeps add-attachment, attachment count, prompt text, and trailing
            controls in one shared block so it still mirrors the git-ops composer shell. */}
        {pickerOpen ? (
          <ComposerFilePicker
            attachments={attachments}
            currentSelection={pendingPickerAttachments}
            errorMessage={errorMessage}
            favoriteFolders={favoriteFolders}
            loading={pickerLoading}
            picker={pickerState}
            panelRef={pickerPanelRef}
            projectRootPath={projectId}
            onAttachAttachments={attachPickerAttachments}
            onOpenRoot={openPickerRoot}
            onOpenDirectory={openPickerDirectory}
            onRemoveAttachment={removeAttachment}
            onToggleFile={togglePendingPickerAttachment}
          />
        ) : null}
        <div className="grid content-end px-4 py-3">
          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-end gap-2">
              <div className="inline-flex h-6 shrink-0 items-center gap-1.5">
                <button
                  ref={pickerButtonRef}
                  type="button"
                  className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md"
                  onClick={pickAttachments}
                  aria-label={attachmentButtonLabel}
                  title={attachmentButtonLabel}
                >
                  <span className={cn(compactIconButtonClass, "shrink-0")}>
                    <Paperclip size={16} />
                  </span>

                  {attachments.length > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[11px] text-[color:var(--text)]">
                      {attachments.length}
                    </span>
                  ) : null}
                </button>

                {attachments.length > 0 ? (
                  <>
                    <button
                      type="button"
                      className={cn(compactIconButtonClass, "h-5 w-5 shrink-0")}
                      onClick={clearAttachments}
                      aria-label="Clear attachments"
                      title="Clear attachments"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : null}
              </div>

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
                  onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
                    event.preventDefault();
                    void handlePaste({
                      clipboardData: event.clipboardData,
                      textarea: event.currentTarget,
                    });
                  }}
                  ariaLabel="Prompt composer"
                  placeholder={placeholderText}
                  reservedLineCount={1}
                  onHeightChange={onLayoutChange}
                />
              </div>
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
