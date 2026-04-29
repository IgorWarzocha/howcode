import { type RefObject, useEffect, useRef } from "react";
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
  isCompacting,
  isExtensionCommandRunning,
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
    extensionCommandRunning,
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
    sessionPath,
    dictationModelId,
    dictationMaxDurationSeconds,
    isStreaming,
    isCompacting,
    isExtensionCommandRunning,
    restoredQueuedPrompt,
    streamingBehaviorPreference,
    onAction,
    onRestoredQueuedPromptApplied,
    onListAttachmentEntries,
  });
  const dictationTranscribing = dictationInterimText.length > 0;
  const slashCommandPanelRef = useRef<HTMLDivElement>(null);
  const slashCommands = useComposerSlashCommands({
    draft,
    projectId,
    sessionPath,
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
        composerPanelRef.current?.contains(target)
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
    (activeView === "thread"
      ? "Ask for follow-up changes"
      : "Ask Pi anything, @ to add files, / for commands, $ for skills");
  const attachmentButtonLabel = attachments.length > 0 ? "Manage attachments" : "Add attachment";

  return (
    <div className="grid gap-0">
      {/* Let the prompt column size itself to one line by default, then grow upward naturally as
          the textarea expands. */}
      <div className="relative">
        {/* The prompt surface keeps add-attachment, attachment count, prompt text, and trailing
            controls in one shared block so it still mirrors the git-ops composer shell. */}
        <ComposerPromptInputPanel
          attachments={attachments}
          attachmentButtonLabel={attachmentButtonLabel}
          canSend={canSend}
          clearAttachments={clearAttachments}
          clearError={clearError}
          dictationActive={dictationActive}
          dictationMissingModel={dictationMissingModel}
          dictationSupported={dictationSupported}
          dictationTranscribing={dictationTranscribing}
          draft={draft}
          errorMessage={errorMessage}
          extensionRunning={extensionRunning}
          favoriteFolders={favoriteFolders}
          isSending={isSending}
          pickerButtonRef={pickerButtonRef}
          pickerLoading={pickerLoading}
          pickerOpen={pickerOpen}
          pickerPanelRef={pickerPanelRef}
          pickerState={pickerState}
          placeholderText={placeholderText}
          projectId={projectId}
          sessionPath={sessionPath}
          slashCommandPanelRef={slashCommandPanelRef}
          slashCommands={slashCommands}
          composerIsStreaming={composerIsStreaming}
          showDictationButton={showDictationButton}
          attachPickerAttachments={attachPickerAttachments}
          cancelDictation={cancelDictation}
          handlePaste={handlePaste}
          onAction={onAction}
          onLayoutChange={onLayoutChange}
          onOpenSettingsView={onOpenSettingsView}
          openPickerDirectory={openPickerDirectory}
          openPickerRoot={openPickerRoot}
          pickAttachments={pickAttachments}
          removeAttachment={removeAttachment}
          setDraft={setDraft}
          stop={stop}
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
