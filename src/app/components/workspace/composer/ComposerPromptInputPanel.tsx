import { Loader2, Paperclip, Send, Square, X } from "lucide-react";
import type { ClipboardEvent, RefObject } from "react";
import { getPathForFileQuery } from "../../../query/desktop-query";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { ComposerDictationControls } from "./ComposerDictationControls";
import { ComposerFilePicker } from "./ComposerFilePicker";
import { ComposerTextField } from "./ComposerTextField";
import {
  getComposerAttachmentsFromClipboardData,
  hasAttachmentHintInClipboardData,
} from "./composer-paste-attachments";
import {
  getComposerSlashCommandGroupLabel,
  getComposerSlashCommandOptionId,
  type ComposerSlashCommands,
} from "./useComposerSlashCommands";
import type { ComposerAttachment, DesktopActionInvoker } from "../../../desktop/types";

type ComposerPromptInputPanelProps = {
  attachments: ComposerAttachment[];
  attachmentButtonLabel: string;
  canSend: boolean;
  clearAttachments: () => void;
  clearError: () => void;
  dictationActive: boolean;
  dictationMissingModel: boolean;
  dictationSupported: boolean;
  dictationTranscribing: boolean;
  draft: string;
  errorMessage: string | null;
  extensionRunning: boolean;
  favoriteFolders: string[];
  isSending: boolean;
  pickerButtonRef: RefObject<HTMLButtonElement | null>;
  pickerLoading: boolean;
  pickerOpen: boolean;
  pickerPanelRef: RefObject<HTMLDivElement | null>;
  pickerState: Parameters<typeof ComposerFilePicker>[0]["picker"];
  placeholderText: string;
  projectId: string;
  sessionPath: string | null;
  slashCommandPanelRef: RefObject<HTMLDivElement | null>;
  slashCommands: ComposerSlashCommands;
  composerIsStreaming: boolean;
  showDictationButton: boolean;
  attachPickerAttachments: Parameters<typeof ComposerFilePicker>[0]["onAttachAttachments"];
  cancelDictation: () => Promise<void>;
  handlePaste: (payload: {
    clipboardData: DataTransfer | ClipboardEvent<HTMLTextAreaElement>["clipboardData"];
    textarea: HTMLTextAreaElement;
  }) => Promise<void>;
  onAction: DesktopActionInvoker;
  onLayoutChange?: () => void;
  onOpenSettingsView: () => void;
  openPickerDirectory: Parameters<typeof ComposerFilePicker>[0]["onOpenDirectory"];
  openPickerRoot: () => void;
  pickAttachments: () => void;
  removeAttachment: (path: string) => void;
  setDraft: (value: string) => void;
  stop: () => Promise<void>;
  toggleDictation: () => void;
  togglePendingPickerAttachment: Parameters<typeof ComposerFilePicker>[0]["onToggleFile"];
};

export function ComposerPromptInputPanel({
  attachments,
  attachmentButtonLabel,
  canSend,
  clearAttachments,
  clearError,
  dictationActive,
  dictationMissingModel,
  dictationSupported,
  dictationTranscribing,
  draft,
  errorMessage,
  extensionRunning,
  favoriteFolders,
  isSending,
  pickerButtonRef,
  pickerLoading,
  pickerOpen,
  pickerPanelRef,
  pickerState,
  placeholderText,
  projectId,
  sessionPath,
  slashCommandPanelRef,
  slashCommands,
  composerIsStreaming,
  showDictationButton,
  attachPickerAttachments,
  cancelDictation,
  handlePaste,
  onAction,
  onLayoutChange,
  onOpenSettingsView,
  openPickerDirectory,
  openPickerRoot,
  pickAttachments,
  removeAttachment,
  setDraft,
  stop,
  toggleDictation,
  togglePendingPickerAttachment,
}: ComposerPromptInputPanelProps) {
  return (
    <>
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
                onClick={() => {
                  if (slashCommands.open) {
                    slashCommands.dismiss({ clearDraft: true });
                  }
                  pickAttachments();
                }}
                aria-label={attachmentButtonLabel}
                data-tooltip={attachmentButtonLabel}
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
                    data-tooltip="Clear attachments"
                  >
                    <X size={12} />
                  </button>
                </>
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
                      const showGroup = previousGroupLabel !== groupLabel;
                      return (
                        <div key={`${command.source}:${command.name}`}>
                          {showGroup ? (
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
                  const directAttachments = getComposerAttachmentsFromClipboardData(clipboardData, {
                    resolveFilePath: (file) => getPathForFileQuery(file as File) ?? null,
                  });
                  const shouldInterceptPaste =
                    directAttachments.length > 0 || hasAttachmentHintInClipboardData(clipboardData);

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
                placeholderTone={errorMessage ? "error" : "muted"}
                statusMessage={errorMessage && draft.length > 0 ? errorMessage : null}
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
              disabled={(!composerIsStreaming && !extensionRunning) || isSending || !sessionPath}
              aria-label="Stop Pi"
              data-tooltip="Stop Pi"
            >
              <Square size={11} fill="currentColor" />
            </button>
            {extensionRunning ? (
              <div className="inline-flex h-6 items-center gap-1.5 rounded-full border border-[rgba(169,178,215,0.14)] bg-[rgba(255,255,255,0.045)] px-2.5 text-[12px] text-[color:var(--muted)]">
                <Loader2 size={12} className="animate-spin" />
                <span>Pi extension running</span>
              </div>
            ) : null}
            <button
              type="button"
              className={cn(
                compactIconButtonClass,
                "h-6 w-6 shrink-0 rounded-full bg-[rgba(146,153,184,0.46)] text-[color:var(--workspace)] hover:bg-[rgba(146,153,184,0.56)] hover:text-[color:var(--workspace)] disabled:cursor-not-allowed disabled:opacity-45",
              )}
              onClick={slashCommands.submit}
              disabled={!canSend}
              aria-label="Send"
              data-tooltip="Send"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
