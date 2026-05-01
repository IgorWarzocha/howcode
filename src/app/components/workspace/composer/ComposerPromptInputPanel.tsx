import { Loader2 } from "lucide-react";
import type { ClipboardEvent, RefObject } from "react";
import { getPathForFileQuery } from "../../../query/desktop-query";
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
  clearError: () => void;
  dictationActive: boolean;
  dictationMissingModel: boolean;
  dictationSupported: boolean;
  dictationTranscribing: boolean;
  draft: string;
  errorMessage: string | null;
  extensionRunning: boolean;
  inputLocked: boolean;
  favoriteFolders: string[];
  pickerLoading: boolean;
  pickerOpen: boolean;
  pickerPanelRef: RefObject<HTMLDivElement | null>;
  pickerState: Parameters<typeof ComposerFilePicker>[0]["picker"];
  placeholderText: string;
  projectId: string;
  slashCommandPanelRef: RefObject<HTMLDivElement | null>;
  slashCommands: ComposerSlashCommands;
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
  openPickerRoot: Parameters<typeof ComposerFilePicker>[0]["onOpenRoot"];
  removeAttachment: (path: string) => void;
  setDraft: (value: string) => void;
  toggleDictation: Parameters<typeof ComposerDictationControls>[0]["toggleDictation"];
  togglePendingPickerAttachment: Parameters<typeof ComposerFilePicker>[0]["onToggleFile"];
};

export function ComposerPromptInputPanel({
  attachments,
  clearError,
  dictationActive,
  dictationMissingModel,
  dictationSupported,
  dictationTranscribing,
  draft,
  errorMessage,
  extensionRunning,
  inputLocked,
  favoriteFolders,
  pickerLoading,
  pickerOpen,
  pickerPanelRef,
  pickerState,
  placeholderText,
  projectId,
  slashCommandPanelRef,
  slashCommands,
  showDictationButton,
  attachPickerAttachments,
  cancelDictation,
  handlePaste,
  onAction,
  onLayoutChange,
  onOpenSettingsView,
  openPickerDirectory,
  openPickerRoot,
  removeAttachment,
  setDraft,
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
      <div className="grid content-end pr-4 pl-[1.1rem] pt-4 pb-1">
        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2">
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
                  if (inputLocked) {
                    event.preventDefault();
                    return;
                  }

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
                  if (inputLocked) {
                    event.preventDefault();
                    return;
                  }

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
                readOnly={inputLocked}
                placeholderTone={errorMessage ? "error" : "muted"}
                statusMessage={errorMessage && draft.length > 0 ? errorMessage : null}
                reservedLineCount={1}
                trailingAdornment={
                  <ComposerDictationControls
                    dictationActive={dictationActive}
                    dictationMissingModel={dictationMissingModel}
                    dictationSupported={dictationSupported}
                    dictationTranscribing={dictationTranscribing}
                    placement="trailing"
                    onAction={onAction}
                    onOpenSettingsView={onOpenSettingsView}
                    showDictationButton={showDictationButton}
                    toggleDictation={toggleDictation}
                  />
                }
                onHeightChange={onLayoutChange}
              />
            </div>
          </div>

          <div className="inline-flex h-8 items-center justify-end gap-2">
            {extensionRunning ? (
              <div className="inline-flex h-6 items-center gap-1.5 rounded-full border border-[rgba(169,178,215,0.14)] bg-[rgba(255,255,255,0.045)] px-2.5 text-[12px] text-[color:var(--muted)]">
                <Loader2 size={12} className="animate-spin" />
                <span>Pi extension running</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
