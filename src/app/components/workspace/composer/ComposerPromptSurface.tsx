import { Paperclip, Send, Square, X } from "lucide-react";
import { type ClipboardEvent, type RefObject, useEffect } from "react";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { getPathForFileQuery } from "../../../query/desktop-query";
import type { ComposerProps } from "../Composer";
import { ComposerDictationControls } from "./ComposerDictationControls";
import { ComposerFooter } from "./ComposerFooter";
import { ComposerFilePicker } from "./ComposerFilePicker";
import { ComposerTextField } from "./ComposerTextField";
import {
  getComposerAttachmentsFromClipboardData,
  hasAttachmentHintInClipboardData,
  hasFilePayloadInClipboardData,
} from "./composer-paste-attachments";
import { useComposerController } from "./useComposerController";
import {
  getComposerSlashCommandOptionId,
  slashCommandSourceLabels,
  useComposerSlashCommands,
} from "./useComposerSlashCommands";

type ComposerPromptSurfaceProps = ComposerProps & {
  composerPanelRef: RefObject<HTMLDivElement | null>;
  mainViewRef: RefObject<HTMLElement | null>;
  workspaceFooterRef: RefObject<HTMLElement | null>;
  onOpenGitOps: () => void;
};

export function ComposerPromptSurface({
  activeView,
  composerPanelRef,
  mainViewRef,
  workspaceFooterRef,
  model,
  contextUsage,
  availableModels,
  isStreaming,
  isCompacting,
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
    pickAttachments,
    openPickerDirectory,
    openPickerRoot,
    removeAttachment,
    runComposerAction,
    compact,
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
    composerPanelRef,
    mainViewRef,
    workspaceFooterRef,
    model,
    projectId,
    sessionPath,
    dictationModelId,
    dictationMaxDurationSeconds,
    isStreaming,
    isCompacting,
    restoredQueuedPrompt,
    streamingBehaviorPreference,
    onAction,
    onRestoredQueuedPromptApplied,
    onListAttachmentEntries,
  });
  const dictationTranscribing = dictationInterimText.length > 0;
  const slashCommands = useComposerSlashCommands({
    draft,
    projectId,
    sessionPath,
    setDraft,
    send,
    onOpenSettingsView,
  });

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
    const handleGlobalFileDrag = (event: DragEvent) => {
      if (!hasFilePayloadInClipboardData(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const handleGlobalDrop = (event: DragEvent) => {
      if (!hasFilePayloadInClipboardData(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      void handleDrop(event.dataTransfer);
    };

    window.addEventListener("dragenter", handleGlobalFileDrag, true);
    window.addEventListener("dragover", handleGlobalFileDrag, true);
    window.addEventListener("drop", handleGlobalDrop, true);

    return () => {
      window.removeEventListener("dragenter", handleGlobalFileDrag, true);
      window.removeEventListener("dragover", handleGlobalFileDrag, true);
      window.removeEventListener("drop", handleGlobalDrop, true);
    };
  }, [handleDrop]);

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
                {slashCommands.open ? (
                  <div
                    id={slashCommands.listboxId}
                    // biome-ignore lint/a11y/useSemanticElements: This is a textarea-owned combobox popup, not a native select.
                    role="listbox"
                    tabIndex={-1}
                    aria-label="Composer slash commands"
                    className="absolute right-3 bottom-[calc(100%-0.25rem)] left-12 z-20 max-h-64 overflow-auto rounded-xl border border-[rgba(169,178,215,0.12)] bg-[#202332] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.38)]"
                  >
                    {slashCommands.commands.length > 0 ? (
                      slashCommands.commands.map((command, index) => {
                        const selected = index === slashCommands.selectedIndex;
                        const previous = slashCommands.commands[index - 1];
                        const showGroup = previous?.source !== command.source;
                        return (
                          <div key={`${command.source}:${command.name}`}>
                            {showGroup ? (
                              <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-2)]">
                                {slashCommandSourceLabels[command.source]}
                              </div>
                            ) : null}
                            <button
                              id={getComposerSlashCommandOptionId(index)}
                              type="button"
                              // biome-ignore lint/a11y/useSemanticElements: Command options remain clickable buttons inside the textarea-owned listbox.
                              role="option"
                              aria-selected={selected}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                                selected
                                  ? "bg-[rgba(169,178,215,0.14)] text-[color:var(--text)]"
                                  : "text-[color:var(--muted)] hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]",
                              )}
                              onPointerEnter={() => slashCommands.setSelectedIndex(index)}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => slashCommands.selectCommand(command)}
                            >
                              <span className="shrink-0 font-mono text-[12px] text-[color:var(--text)]">
                                /{command.name}
                              </span>
                              {command.description ? (
                                <span className="min-w-0 truncate text-[12px]">
                                  {command.description}
                                </span>
                              ) : null}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-2 py-2 text-[12px] text-[color:var(--muted)]">
                        {slashCommands.loading ? "Loading commands…" : "No matching commands"}
                      </div>
                    )}
                  </div>
                ) : null}
                <ComposerTextField
                  value={draft}
                  onChange={setDraft}
                  onInput={() => {
                    if (errorMessage) {
                      clearError();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (slashCommands.handleKeyDown(event)) {
                      return;
                    }

                    if (event.key === "Escape" && (dictationActive || dictationTranscribing)) {
                      event.preventDefault();
                      void cancelDictation();
                      return;
                    }

                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      slashCommands.submit();
                    }
                  }}
                  onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
                    const clipboardData = event.clipboardData;
                    const directAttachments = getComposerAttachmentsFromClipboardData(
                      clipboardData,
                      {
                        resolveFilePath: (file) => getPathForFileQuery(file as File) ?? null,
                      },
                    );
                    const shouldInterceptPaste =
                      directAttachments.length > 0 ||
                      hasAttachmentHintInClipboardData(clipboardData);

                    if (!shouldInterceptPaste) {
                      return;
                    }

                    event.preventDefault();
                    void handlePaste({
                      clipboardData,
                      textarea: event.currentTarget,
                    });
                  }}
                  ariaLabel="Prompt composer"
                  ariaActiveDescendant={slashCommands.activeDescendantId}
                  ariaControls={slashCommands.open ? slashCommands.listboxId : undefined}
                  ariaExpanded={slashCommands.open}
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
                onClick={slashCommands.submit}
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
        contextUsage={contextUsage}
        compactDisabled={isStreaming || isCompacting || !sessionPath}
        isCompacting={isCompacting}
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
        onCompact={() => void compact()}
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
