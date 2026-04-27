import { ArrowUpRight, Bot, Paperclip, Send, Square, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { getDesktopActionErrorMessage } from "../../../desktop/action-results";
import { getErrorMessage } from "../../../desktop/error-messages";
import type {
  AppSettings,
  ComposerAttachment,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxThread,
} from "../../../desktop/types";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { IconButton } from "../../common/IconButton";
import { ToolbarButton } from "../../common/ToolbarButton";
import { Tooltip } from "../../common/Tooltip";
import { ComposerContextMeter } from "../composer/ComposerContextMeter";
import { ComposerDictationControls } from "../composer/ComposerDictationControls";
import { ComposerFilePicker } from "../composer/ComposerFilePicker";
import { ComposerModelPopover } from "../composer/ComposerModelPopover";
import { ComposerTextField } from "../composer/ComposerTextField";
import {
  getComposerSlashCommandGroupLabel,
  getComposerSlashCommandOptionId,
  useComposerSlashCommands,
} from "../composer/useComposerSlashCommands";
import { useComposerAttachmentPicker } from "../composer/useComposerAttachmentPicker";
import { useComposerDictation } from "../composer/useComposerDictation";

const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "X-High",
};

type InboxComposerProps = {
  appSettings: AppSettings;
  attachments: ComposerAttachment[];
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  contextUsage: ComposerContextUsage | null;
  currentModel: ComposerModel | null;
  currentThinkingLevel: ComposerThinkingLevel;
  draft: string;
  errorMessage: string | null;
  favoriteFolders: string[];
  isCompacting: boolean;
  isStreaming: boolean;
  isSending: boolean;
  showDictationButton: boolean;
  thread: InboxThread;
  onAction: DesktopActionInvoker;
  onChangeAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  onChangeDraft: Dispatch<SetStateAction<string>>;
  onChangeErrorMessage: Dispatch<SetStateAction<string | null>>;
  onDismiss: () => void;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
  onOpenThread: () => void;
  onOpenSettingsView: () => void;
  onSend: (input: { draft: string; attachments: ComposerAttachment[] }) => Promise<void> | void;
  onStop: () => void;
};

export function InboxComposer({
  appSettings,
  attachments,
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  draft,
  errorMessage,
  favoriteFolders,
  isCompacting,
  isStreaming,
  isSending,
  showDictationButton,
  thread,
  onAction,
  onChangeAttachments,
  onChangeDraft,
  onChangeErrorMessage,
  onDismiss,
  onListAttachmentEntries,
  onOpenThread,
  onOpenSettingsView,
  onSend,
  onStop,
}: InboxComposerProps) {
  const [openMenu, setOpenMenu] = useState<"model" | "picker" | null>(null);
  const composerPanelRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const slashCommandPanelRef = useRef<HTMLDivElement>(null);
  const draftValueRef = useRef(draft);
  const attachmentsRef = useRef(attachments);
  const sendLockRef = useRef(false);
  const [localActionPending, setLocalActionPending] = useState(false);
  const canSend =
    (draft.trim().length > 0 || attachments.length > 0) &&
    !isSending &&
    !isCompacting &&
    !localActionPending;

  useEffect(() => {
    draftValueRef.current = draft;
  }, [draft]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const setDraftValue: Dispatch<SetStateAction<string>> = (value) => {
    const nextValue =
      typeof value === "function"
        ? (value as (current: string) => string)(draftValueRef.current)
        : value;
    draftValueRef.current = nextValue;
    onChangeDraft(nextValue);
  };

  const setAttachmentValue: Dispatch<SetStateAction<ComposerAttachment[]>> = (value) => {
    const nextValue =
      typeof value === "function"
        ? (value as (current: ComposerAttachment[]) => ComposerAttachment[])(attachmentsRef.current)
        : value;
    attachmentsRef.current = nextValue;
    onChangeAttachments(nextValue);
  };

  useDismissibleLayer({
    open: openMenu === "model",
    onDismiss: () => setOpenMenu(null),
    refs: [modelButtonRef, modelMenuRef],
  });

  useEffect(() => {
    if (openMenu !== "picker") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (pickerButtonRef.current?.contains(target) || pickerPanelRef.current?.contains(target)) {
        return;
      }

      if (composerPanelRef.current?.contains(target)) {
        return;
      }

      setOpenMenu((current) => (current === "picker" ? null : current));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      setOpenMenu((current) => (current === "picker" ? null : current));
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [openMenu]);

  const {
    attachPickerAttachments,
    clearAttachments,
    openPickerDirectory,
    openPickerRoot,
    pickAttachments,
    pickerLoading,
    pickerState,
    removeAttachment,
    togglePendingPickerAttachment,
  } = useComposerAttachmentPicker({
    openMenu,
    pickerRootPath: thread.projectId,
    pickerSessionKey: thread.sessionPath,
    setAttachments: setAttachmentValue,
    setErrorMessage: onChangeErrorMessage,
    setOpenMenu,
    onListAttachmentEntries,
  });

  const {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    stopDictationAndFlush,
    toggleDictation,
  } = useComposerDictation({
    activeView: "inbox",
    dictationModelId: appSettings.dictationModelId,
    dictationMaxDurationSeconds: appSettings.dictationMaxDurationSeconds,
    draftThreadId: thread.threadId,
    projectId: thread.projectId,
    sessionPath: thread.sessionPath,
    setDraftValue,
    setErrorMessage: onChangeErrorMessage,
  });

  const send = async () => {
    if (sendLockRef.current || isSending || isCompacting || localActionPending) {
      return;
    }

    sendLockRef.current = true;
    setLocalActionPending(true);
    try {
      await stopDictationAndFlush();
      await onSend({ draft: draftValueRef.current, attachments: attachmentsRef.current });
    } finally {
      sendLockRef.current = false;
      setLocalActionPending(false);
    }
  };

  const slashCommands = useComposerSlashCommands({
    draft,
    projectId: thread.projectId,
    sessionPath: thread.sessionPath,
    setDraft: setDraftValue,
    send: () => void send(),
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

      if (!target) {
        return;
      }

      if (
        slashCommandPanelRef.current?.contains(target) ||
        composerPanelRef.current?.contains(target)
      ) {
        return;
      }

      slashCommands.dismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      slashCommands.dismiss();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [slashCommands]);

  useEffect(() => {
    if (!slashCommands.open || !slashCommands.activeDescendantId) {
      return;
    }

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

  const compact = async () => {
    if (sendLockRef.current || isSending || isStreaming || isCompacting || !thread.sessionPath) {
      return;
    }

    sendLockRef.current = true;
    setLocalActionPending(true);
    onChangeErrorMessage(null);
    try {
      await stopDictationAndFlush();
      const result = await onAction("composer.send", {
        projectId: thread.projectId,
        sessionPath: thread.sessionPath,
        text: "/compact",
        attachments: [],
        streamingBehavior: appSettings.composerStreamingBehavior,
      });

      const actionErrorMessage = getDesktopActionErrorMessage(result, "Could not compact context.");
      if (actionErrorMessage) {
        onChangeErrorMessage(actionErrorMessage);
      }
    } catch (error) {
      onChangeErrorMessage(getErrorMessage(error, "Could not compact context."));
    } finally {
      sendLockRef.current = false;
      setLocalActionPending(false);
    }
  };

  return (
    <div
      ref={composerPanelRef}
      className="grid gap-0 overflow-visible rounded-[20px] border border-[rgba(169,178,215,0.06)] bg-[#272a39] shadow-none"
      aria-label="Inbox composer panel"
    >
      <div className="relative">
        {openMenu === "picker" ? (
          <ComposerFilePicker
            attachments={attachments}
            errorMessage={errorMessage}
            favoriteFolders={favoriteFolders}
            loading={pickerLoading}
            picker={pickerState}
            panelRef={pickerPanelRef}
            projectRootPath={thread.projectId}
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
                  aria-label={attachments.length > 0 ? "Manage attachments" : "Add attachment"}
                  title={attachments.length > 0 ? "Manage attachments" : "Add attachment"}
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
                  <button
                    type="button"
                    className={cn(compactIconButtonClass, "h-5 w-5 shrink-0")}
                    onClick={clearAttachments}
                    aria-label="Clear attachments"
                    title="Clear attachments"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                {slashCommands.open ? (
                  <div
                    ref={slashCommandPanelRef}
                    id={slashCommands.listboxId}
                    // biome-ignore lint/a11y/useSemanticElements: This is a textarea-owned combobox popup, not a native select.
                    role="listbox"
                    tabIndex={-1}
                    aria-label="Composer slash commands"
                    className="absolute right-0 bottom-full left-0 z-20 max-h-64 scroll-py-1.5 overflow-auto rounded-xl border border-[rgba(169,178,215,0.12)] bg-[#202332] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.38)]"
                  >
                    {slashCommands.commands.length > 0 ? (
                      slashCommands.commands.map((command, index) => {
                        const selected = index === slashCommands.selectedIndex;
                        const previous = slashCommands.commands[index - 1];
                        const groupLabel = getComposerSlashCommandGroupLabel(command);
                        const previousGroupLabel = previous
                          ? getComposerSlashCommandGroupLabel(previous)
                          : null;
                        return (
                          <div key={`${command.source}:${command.name}`}>
                            {previousGroupLabel !== groupLabel ? (
                              <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-2)]">
                                {groupLabel}
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
                  onChange={setDraftValue}
                  onKeyDown={(event) => {
                    if (slashCommands.handleKeyDown(event)) {
                      return;
                    }

                    if (event.key === "Escape" && (dictationActive || dictationInterimText)) {
                      event.preventDefault();
                      void cancelDictation();
                      return;
                    }

                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      slashCommands.submit();
                    }
                  }}
                  ariaLabel="Inbox prompt composer"
                  ariaActiveDescendant={slashCommands.activeDescendantId}
                  ariaControls={slashCommands.open ? slashCommands.listboxId : undefined}
                  ariaExpanded={slashCommands.open}
                  placeholder={errorMessage ?? "Reply to this thread…"}
                  placeholderTone={errorMessage ? "error" : "muted"}
                  statusMessage={errorMessage && draft.length > 0 ? errorMessage : null}
                  reservedLineCount={1}
                />
              </div>
            </div>

            <div className="inline-flex h-8 items-center justify-end gap-2">
              <ComposerDictationControls
                dictationActive={dictationActive}
                dictationMissingModel={dictationMissingModel}
                dictationSupported={dictationSupported}
                dictationTranscribing={dictationInterimText.length > 0 && !dictationActive}
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
                onClick={onStop}
                disabled={!isStreaming || isSending || localActionPending}
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
                onClick={() => slashCommands.submit()}
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
        <output className="sr-only" aria-live="polite">
          {errorMessage}
        </output>
      ) : null}

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      <div className="flex items-center justify-end gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
        <div className="relative mr-auto inline-flex h-7 items-center">
          <ToolbarButton
            ref={modelButtonRef}
            label="Agent"
            icon={<Bot size={14} />}
            className="pr-8"
            onClick={() => setOpenMenu((current) => (current === "model" ? null : "model"))}
            aria-haspopup="menu"
            aria-expanded={openMenu === "model"}
            aria-controls="composer-model-menu"
          />
          <div className="absolute top-0 right-0">
            <ComposerContextMeter
              contextUsage={contextUsage}
              compactDisabled={
                isStreaming || isCompacting || localActionPending || !thread.sessionPath
              }
              isCompacting={isCompacting}
              onCompact={() => void compact()}
            />
          </div>
          {openMenu === "model" ? (
            <ComposerModelPopover
              availableModels={availableModels}
              availableThinkingLevels={availableThinkingLevels}
              currentModel={currentModel}
              currentThinkingLevel={currentThinkingLevel}
              panelRef={modelMenuRef}
              thinkingLevelLabels={thinkingLevelLabels}
              onSelectModel={(availableModel) => {
                void onAction("composer.model", {
                  provider: availableModel.provider,
                  modelId: availableModel.id,
                  projectId: thread.projectId,
                  sessionPath: thread.sessionPath,
                });
                setOpenMenu(null);
              }}
              onSelectThinkingLevel={(level) => {
                void onAction("composer.thinking", {
                  level,
                  projectId: thread.projectId,
                  sessionPath: thread.sessionPath,
                });
                setOpenMenu(null);
              }}
            />
          ) : null}
        </div>
        <Tooltip content="Dismiss">
          <IconButton label="Dismiss" icon={<X size={14} />} onClick={onDismiss} />
        </Tooltip>
        <Tooltip content="Open thread">
          <IconButton
            label="Open thread"
            icon={<ArrowUpRight size={14} />}
            onClick={onOpenThread}
          />
        </Tooltip>
      </div>
    </div>
  );
}
