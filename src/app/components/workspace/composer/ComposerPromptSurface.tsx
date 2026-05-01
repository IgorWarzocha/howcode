import { Paperclip, Square, X } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import type { ComposerProps } from "../Composer";
import { ComposerFooter } from "./ComposerFooter";
import { ComposerPromptInputPanel } from "./ComposerPromptInputPanel";
import { hasFilePayloadInClipboardData } from "./composer-paste-attachments";
import { useComposerController } from "./controller/useComposerController";
import { useComposerSlashCommands } from "./useComposerSlashCommands";

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
  replyActivityKey,
  isCompacting,
  isExtensionCommandRunning,
  thinkingLevel,
  restoredQueuedPrompt,
  streamingBehaviorPreference,
  availableThinkingLevels,
  projectId,
  chatGroupId,
  projectGitState,
  diffBaseline,
  sessionPath,
  dictationModelId,
  dictationMaxDurationSeconds,
  favoriteFolders,
  showDictationButton,
  onOpenTakeoverTerminal,
  onToggleTerminal,
  onToggleArtifacts,
  onOpenSettingsView,
  onRestoredQueuedPromptApplied,
  onListAttachmentEntries,
  onAction,
  terminalVisible,
  artifactsVisible,
  artifactsAvailable,
  onSetDiffBaseline,
  onOpenGitOps,
  onLayoutChange,
  showTerminalControls = true,
}: ComposerPromptSurfaceProps) {
  const {
    attachments,
    cancelDictation,
    clearAttachments,
    clearError,
    draft,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    errorMessage,
    extensionCommandRunning,
    inputLocked,
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
    sendExtensionCommand,
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
    chatGroupId,
    sessionPath,
    dictationModelId,
    dictationMaxDurationSeconds,
    isStreaming,
    replyActivityKey,
    isCompacting,
    isExtensionCommandRunning,
    restoredQueuedPrompt,
    streamingBehaviorPreference,
    onAction,
    onRestoredQueuedPromptApplied,
    onListAttachmentEntries,
  });
  const dictationTranscribing = dictationInterimText.length > 0;
  const composerMode = activeView === "chat" ? "chat" : "code";
  const slashCommandPanelRef = useRef<HTMLDivElement>(null);
  const stopButtonBoundaryRef = useRef<HTMLDivElement>(null);
  const slashCommands = useComposerSlashCommands({
    draft,
    projectId,
    sessionPath,
    composerMode,
    setDraft,
    send,
    sendExtensionCommand,
    onOpenSettingsView,
  });
  const slashCommandListSignature = slashCommands.commands
    .map((command) => `${command.source}:${command.name}`)
    .join("|");

  useEffect(() => {
    if (!slashCommands.open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        !target ||
        slashCommandPanelRef.current?.contains(target) ||
        composerPanelRef.current?.contains(target) ||
        stopButtonBoundaryRef.current?.contains(target)
      ) {
        return;
      }

      slashCommands.dismiss({ clearDraft: true });
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [composerPanelRef, slashCommands]);

  useEffect(() => {
    if (!slashCommands.open || !slashCommands.activeDescendantId) {
      return;
    }

    // Keep the effect tied to command content changes too: the active id can remain
    // `...-0` while filtering swaps the actual first row underneath it.
    void slashCommandListSignature;

    const panel = slashCommandPanelRef.current;
    const option = panel?.querySelector<HTMLElement>(`#${slashCommands.activeDescendantId}`);
    if (!panel || !option) {
      return;
    }

    if (slashCommands.selectedIndex === 0) {
      panel.scrollTop = 0;
      return;
    }

    const panelStyles = window.getComputedStyle(panel);
    const paddingTop = Number.parseFloat(panelStyles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(panelStyles.paddingBottom) || 0;
    const visibleTop = panel.scrollTop + paddingTop;
    const visibleBottom = panel.scrollTop + panel.clientHeight - paddingBottom;
    const optionTop = option.offsetTop;
    const optionBottom = optionTop + option.offsetHeight;

    if (optionTop < visibleTop) {
      panel.scrollTop = optionTop - paddingTop;
    } else if (optionBottom > visibleBottom) {
      panel.scrollTop = optionBottom - panel.clientHeight + paddingBottom;
    }
  }, [
    slashCommands.open,
    slashCommands.activeDescendantId,
    slashCommands.selectedIndex,
    slashCommandListSignature,
  ]);

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

  const extensionRunning = extensionCommandRunning;
  const placeholderText =
    errorMessage ??
    (activeView === "chat" || activeView === "thread"
      ? "Hover to type · Enter sends · Shift+Enter for a new line"
      : "Hover to type · / commands · @ files · Enter sends");
  const attachmentButtonLabel = attachments.length > 0 ? "Manage attachments" : "Add attachment";
  const canStopComposer = (composerIsStreaming || extensionRunning) && !isSending && !!sessionPath;

  return (
    <div className="relative left-1/2 grid w-[calc(100%+5rem)] -translate-x-1/2 grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-2 overflow-visible">
      <div className="relative mb-[3.55rem] h-8 w-8 shrink-0 text-[color:var(--muted)]">
        <div className="absolute bottom-0 left-0 flex w-7 flex-col-reverse items-center gap-1">
          <button
            ref={pickerButtonRef}
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            onClick={() => {
              if (slashCommands.open) {
                slashCommands.dismiss({ clearDraft: true });
              }
              pickAttachments();
            }}
            aria-label={attachmentButtonLabel}
            data-tooltip={attachmentButtonLabel}
          >
            <span className={cn(compactIconButtonClass, "h-7 w-7 shrink-0 rounded-full")}>
              <Paperclip size={15} />
            </span>
          </button>

          {attachments.length > 0 ? (
            <>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[11px] text-[color:var(--text)]">
                {attachments.length}
              </span>
              <button
                type="button"
                className={cn(
                  compactIconButtonClass,
                  "h-5 w-5 rounded-full opacity-70 hover:opacity-100",
                )}
                onClick={clearAttachments}
                aria-label="Clear attachments"
                data-tooltip="Clear attachments"
              >
                <X size={11} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={composerPanelRef}
        className="grid gap-0 overflow-visible rounded-[20px] border border-[rgba(169,178,215,0.06)] bg-[#272a39] shadow-none"
        aria-label="Composer panel"
      >
        {/* Let the prompt column size itself to one line by default, then grow upward naturally as
            the textarea expands. */}
        <div className="relative">
          {/* The prompt surface keeps prompt text and trailing controls in one shared block so it
              still mirrors the git-ops composer shell while attachments live beside it. */}
          <ComposerPromptInputPanel
            attachments={attachments}
            clearError={clearError}
            dictationActive={dictationActive}
            dictationMissingModel={dictationMissingModel}
            dictationSupported={dictationSupported}
            dictationTranscribing={dictationTranscribing}
            draft={draft}
            errorMessage={errorMessage}
            extensionRunning={extensionRunning}
            inputLocked={inputLocked}
            favoriteFolders={favoriteFolders}
            pickerLoading={pickerLoading}
            pickerOpen={pickerOpen}
            pickerPanelRef={pickerPanelRef}
            pickerState={pickerState}
            placeholderText={placeholderText}
            projectId={projectId}
            slashCommandPanelRef={slashCommandPanelRef}
            slashCommands={slashCommands}
            showDictationButton={showDictationButton}
            attachPickerAttachments={attachPickerAttachments}
            cancelDictation={cancelDictation}
            handlePaste={handlePaste}
            onAction={onAction}
            onLayoutChange={onLayoutChange}
            onOpenSettingsView={onOpenSettingsView}
            openPickerDirectory={openPickerDirectory}
            openPickerRoot={openPickerRoot}
            removeAttachment={removeAttachment}
            setDraft={setDraft}
            toggleDictation={toggleDictation}
            togglePendingPickerAttachment={togglePendingPickerAttachment}
          />
        </div>

        {errorMessage ? (
          <output className="sr-only" aria-live="polite">
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
            if (activeView === "chat" || activeView === "thread") {
              void runComposerAction(
                "settings.update",
                {
                  key: composerMode === "chat" ? "chatModel" : "codeModel",
                  provider: availableModel.provider,
                  modelId: availableModel.id,
                },
                { closeMenu: false },
              );
              return;
            }

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
            if (activeView === "chat" || activeView === "thread") {
              void runComposerAction("settings.update", {
                key: composerMode === "chat" ? "chatThinkingLevel" : "codeThinkingLevel",
                value: level,
              });
              return;
            }

            void runComposerAction("composer.thinking", {
              level,
              projectId,
              sessionPath,
            });
          }}
          onCompact={() => void compact()}
          onSetOpenMenu={setOpenMenu}
          onToggleTerminal={onToggleTerminal}
          onToggleArtifacts={onToggleArtifacts}
          projectGitState={projectGitState}
          projectId={projectId}
          showTerminalControls={showTerminalControls}
          terminalVisible={terminalVisible}
          artifactsVisible={artifactsVisible}
          artifactsAvailable={artifactsAvailable}
          thinkingLevel={thinkingLevel}
          thinkingLevelLabels={thinkingLevelLabels}
        />
      </div>

      <div
        ref={stopButtonBoundaryRef}
        className="mb-[3.55rem] inline-flex h-8 shrink-0 items-center justify-end text-[color:var(--muted)]"
      >
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            "h-7 w-7 shrink-0 rounded-full text-[#ffb4b4] hover:bg-[rgba(229,111,111,0.2)] hover:text-[#ffd1d1]",
            canStopComposer
              ? "bg-[rgba(229,111,111,0.14)] opacity-80"
              : "bg-transparent opacity-25 hover:opacity-45",
          )}
          onClick={() => void stop()}
          disabled={!canStopComposer}
          aria-label="Stop Pi"
          data-tooltip="Stop Pi"
        >
          <Square size={11} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
