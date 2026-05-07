import { Loader2 } from 'lucide-react'
import type { ClipboardEvent, KeyboardEvent, RefObject } from 'react'
import type { ComposerAttachment, DesktopActionInvoker } from '../../../desktop/types'
import { getPathForFileQuery } from '../../../query/desktop-query'
import { cn } from '../../../utils/cn'
import { ComposerDictationControls } from './composer-dictation-controls'
import { ComposerFileMentionPanel } from './composer-file-mention-panel'
import { ComposerFilePicker } from './composer-file-picker'
import {
  getComposerAttachmentsFromClipboardData,
  hasAttachmentHintInClipboardData,
} from './composer-paste-attachments'
import { ComposerSkillMentionPanel } from './composer-skill-mention-panel'
import { ComposerTextField } from './composer-text-field'
import type { ComposerFileMentions } from './useComposerFileMentions'
import type { ComposerSkillMentions } from './useComposerSkillMentions'
import {
  type ComposerSlashCommands,
  getComposerSlashCommandGroupLabel,
  getComposerSlashCommandOptionId,
} from './useComposerSlashCommands'

function SlashCommandOption({
  command,
  index,
  previousCommand,
  selected,
  slashCommands,
}: {
  command: ComposerSlashCommands['commands'][number]
  index: number
  previousCommand: ComposerSlashCommands['commands'][number] | undefined
  selected: boolean
  slashCommands: ComposerSlashCommands
}) {
  const groupLabel = getComposerSlashCommandGroupLabel(command)
  const previousGroupLabel = previousCommand
    ? getComposerSlashCommandGroupLabel(previousCommand)
    : null
  return (
    <div key={`${command.source}:${command.name}`}>
      {previousGroupLabel === groupLabel ? null : (
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-2)]">
          {groupLabel}
        </div>
      )}
      <button
        id={getComposerSlashCommandOptionId(index)}
        type="button"
        role="option"
        aria-selected={selected}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
          selected
            ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
        )}
        onPointerEnter={() => slashCommands.setSelectedIndex(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => slashCommands.selectCommand(command)}
      >
        <span className="shrink-0 font-mono text-[12px] text-[color:var(--text)]">
          /{command.name}
        </span>
        {command.description ? (
          <span className="min-w-0 truncate text-[12px]">{command.description}</span>
        ) : null}
      </button>
    </div>
  )
}

function SlashCommandPanel({
  panelRef,
  slashCommands,
}: {
  panelRef: RefObject<HTMLDivElement | null>
  slashCommands: ComposerSlashCommands
}) {
  if (!slashCommands.open) return null
  return (
    <div
      ref={panelRef}
      id={slashCommands.listboxId}
      role="listbox"
      tabIndex={-1}
      aria-label="Composer slash commands"
      className="absolute right-0 bottom-full left-0 z-20 max-h-64 scroll-py-1.5 overflow-auto rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--panel)] p-1.5 shadow-[var(--shadow)]"
    >
      {slashCommands.commands.length > 0 ? (
        slashCommands.commands.map((command, index) => (
          <SlashCommandOption
            key={`${command.source}:${command.name}`}
            command={command}
            index={index}
            previousCommand={slashCommands.commands[index - 1]}
            selected={index === slashCommands.selectedIndex}
            slashCommands={slashCommands}
          />
        ))
      ) : (
        <div className="px-2 py-2 text-[12px] text-[color:var(--muted)]">
          {slashCommands.loading ? 'Loading commands…' : 'No matching commands'}
        </div>
      )}
    </div>
  )
}

type ComposerKeyDownInput = {
  cancelDictation: () => Promise<void>
  clearError: () => void
  dictationActive: boolean
  dictationTranscribing: boolean
  inputLocked: boolean
  onArrowNavigationOverride?: ((direction: 'previous' | 'next') => boolean) | undefined
  onEscapeOverride?: (() => boolean) | undefined
  onSubmitOverride?: (() => boolean) | undefined
  slashCommands: ComposerSlashCommands
  fileMentions: ComposerFileMentions
  skillMentions: ComposerSkillMentions
  setDraft: (value: string) => void
}

function isCursorAtStart(textarea: HTMLTextAreaElement) {
  return textarea.selectionStart === textarea.selectionEnd && textarea.selectionStart === 0
}

function isCursorAtEnd(textarea: HTMLTextAreaElement) {
  return (
    textarea.selectionStart === textarea.selectionEnd &&
    textarea.selectionEnd === textarea.value.length
  )
}

function handleOpenAutocompleteKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  input: ComposerKeyDownInput,
) {
  return (
    input.slashCommands.handleKeyDown(event) ||
    input.fileMentions.handleKeyDown(event) ||
    input.skillMentions.handleKeyDown(event)
  )
}

function handleDeleteTextKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  setDraft: (value: string) => void,
  clearError: () => void,
) {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return false
  if (event.altKey || event.ctrlKey || event.metaKey) return false
  const textarea = event.currentTarget
  const selectionStart = textarea.selectionStart
  const selectionEnd = textarea.selectionEnd
  const segments = [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(textarea.value),
  ]
  const previousSegment = [...segments].reverse().find((segment) => segment.index < selectionStart)
  const nextSegment = segments.find((segment) => segment.index > selectionEnd)
  const deleteStart =
    selectionStart === selectionEnd && event.key === 'Backspace'
      ? (previousSegment?.index ?? 0)
      : selectionStart
  const deleteEnd =
    selectionStart === selectionEnd && event.key === 'Delete'
      ? (nextSegment?.index ?? textarea.value.length)
      : selectionEnd
  if (deleteStart === deleteEnd) return false
  event.preventDefault()
  const nextValue = `${textarea.value.slice(0, deleteStart)}${textarea.value.slice(deleteEnd)}`
  setDraft(nextValue)
  clearError()
  window.requestAnimationFrame(() => textarea.setSelectionRange(deleteStart, deleteStart))
  return true
}

function handleHorizontalBoundaryNavigation(
  event: KeyboardEvent<HTMLTextAreaElement>,
  onArrowNavigationOverride: ((direction: 'previous' | 'next') => boolean) | undefined,
) {
  if (
    event.key === 'ArrowLeft' &&
    isCursorAtStart(event.currentTarget) &&
    onArrowNavigationOverride?.('previous')
  ) {
    event.preventDefault()
    return true
  }
  if (
    event.key === 'ArrowRight' &&
    isCursorAtEnd(event.currentTarget) &&
    onArrowNavigationOverride?.('next')
  ) {
    event.preventDefault()
    return true
  }
  return false
}

function handleComposerTextKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  input: ComposerKeyDownInput,
) {
  if (input.inputLocked) {
    event.preventDefault()
    return
  }
  if (event.key === 'Escape' && (input.dictationActive || input.dictationTranscribing)) {
    event.preventDefault()
    void input.cancelDictation()
    return
  }
  if (event.key === 'Escape' && input.onEscapeOverride?.()) {
    event.preventDefault()
    return
  }
  if (handleDeleteTextKey(event, input.setDraft, input.clearError)) {
    return
  }
  if (handleOpenAutocompleteKeyDown(event, input)) {
    return
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (!input.onSubmitOverride?.()) input.slashCommands.submit()
    return
  }
  if (handleHorizontalBoundaryNavigation(event, input.onArrowNavigationOverride)) {
    return
  }
}

type ComposerPromptInputPanelProps = {
  attachments: ComposerAttachment[]
  clearError: () => void
  dictationActive: boolean
  dictationMissingModel: boolean
  dictationSupported: boolean
  dictationTranscribing: boolean
  draft: string
  errorMessage: string | null
  extensionRunning: boolean
  inputLocked: boolean
  hoverToFocus: boolean
  hoverToBlur: boolean
  favoriteFolders: string[]
  pickerLoading: boolean
  pickerOpen: boolean
  pickerButtonRef: RefObject<HTMLButtonElement | null>
  hoverBoundaryRef: RefObject<HTMLElement | null>
  pickerPanelRef: RefObject<HTMLDivElement | null>
  preferSideFilePicker?: boolean
  pickerState: Parameters<typeof ComposerFilePicker>[0]['picker']
  placeholderText: string
  projectId: string
  slashCommandPanelRef: RefObject<HTMLDivElement | null>
  slashCommands: ComposerSlashCommands
  fileMentionPanelRef: RefObject<HTMLDivElement | null>
  fileMentions: ComposerFileMentions
  skillMentionPanelRef: RefObject<HTMLDivElement | null>
  skillMentions: ComposerSkillMentions
  showDictationButton: boolean
  attachPickerAttachments: Parameters<typeof ComposerFilePicker>[0]['onAttachAttachments']
  cancelDictation: () => Promise<void>
  handlePaste: (payload: {
    clipboardData: DataTransfer | ClipboardEvent<HTMLTextAreaElement>['clipboardData']
    textarea: HTMLTextAreaElement
  }) => Promise<void>
  onAction: DesktopActionInvoker
  onLayoutChange?: () => void
  onOpenSettingsView: () => void
  onArrowNavigationOverride?: ((direction: 'previous' | 'next') => boolean) | undefined
  onEscapeOverride?: (() => boolean) | undefined
  onSubmitOverride?: (() => boolean) | undefined
  openPickerDirectory: Parameters<typeof ComposerFilePicker>[0]['onOpenDirectory']
  openPickerRoot: Parameters<typeof ComposerFilePicker>[0]['onOpenRoot']
  removeAttachment: (path: string) => void
  setDraft: (value: string) => void
  toggleDictation: Parameters<typeof ComposerDictationControls>[0]['toggleDictation']
  togglePendingPickerAttachment: Parameters<typeof ComposerFilePicker>[0]['onToggleFile']
}

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
  hoverToFocus,
  hoverToBlur,
  favoriteFolders,
  hoverBoundaryRef,
  pickerLoading,
  pickerOpen,
  pickerButtonRef,
  pickerPanelRef,
  preferSideFilePicker = false,
  pickerState,
  placeholderText,
  projectId,
  slashCommandPanelRef,
  slashCommands,
  fileMentionPanelRef,
  fileMentions,
  skillMentionPanelRef,
  skillMentions,
  showDictationButton,
  attachPickerAttachments,
  cancelDictation,
  handlePaste,
  onAction,
  onLayoutChange,
  onOpenSettingsView,
  onArrowNavigationOverride,
  onEscapeOverride,
  onSubmitOverride,
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
          anchorRef={pickerButtonRef}
          attachments={attachments}
          errorMessage={errorMessage}
          favoriteFolders={favoriteFolders}
          loading={pickerLoading}
          picker={pickerState}
          panelRef={pickerPanelRef}
          preferSidePlacement={preferSideFilePicker}
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
              <SlashCommandPanel panelRef={slashCommandPanelRef} slashCommands={slashCommands} />
              <ComposerTextField
                value={draft}
                onChange={setDraft}
                onInput={() => {
                  if (errorMessage) {
                    clearError()
                  }
                }}
                onKeyDown={(event) =>
                  handleComposerTextKeyDown(event, {
                    cancelDictation,
                    clearError,
                    dictationActive,
                    dictationTranscribing,
                    fileMentions,
                    inputLocked,
                    onArrowNavigationOverride,
                    onEscapeOverride,
                    onSubmitOverride,
                    setDraft,
                    slashCommands,
                    skillMentions,
                  })
                }
                onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
                  if (inputLocked) {
                    event.preventDefault()
                    return
                  }

                  const clipboardData = event.clipboardData
                  const directAttachments = getComposerAttachmentsFromClipboardData(clipboardData, {
                    resolveFilePath: (file) => getPathForFileQuery(file as File) ?? null,
                  })
                  const shouldInterceptPaste =
                    directAttachments.length > 0 || hasAttachmentHintInClipboardData(clipboardData)

                  if (!shouldInterceptPaste) {
                    return
                  }

                  event.preventDefault()
                  void handlePaste({
                    clipboardData,
                    textarea: event.currentTarget,
                  })
                }}
                ariaLabel="Prompt composer"
                ariaActiveDescendant={
                  slashCommands.activeDescendantId ??
                  fileMentions.activeDescendantId ??
                  skillMentions.activeDescendantId
                }
                ariaControls={
                  slashCommands.open
                    ? slashCommands.listboxId
                    : fileMentions.open
                      ? fileMentions.listboxId
                      : skillMentions.open
                        ? skillMentions.listboxId
                        : undefined
                }
                placeholder={placeholderText}
                readOnly={inputLocked}
                hoverToFocus={hoverToFocus}
                hoverToBlur={hoverToBlur}
                hoverBoundaryRef={hoverBoundaryRef}
                placeholderTone={errorMessage ? 'error' : 'muted'}
                statusMessage={errorMessage && draft.length > 0 ? errorMessage : null}
                reservedLineCount={1}
                inlinePopover={
                  fileMentions.open ? (
                    <ComposerFileMentionPanel
                      fileMentions={fileMentions}
                      panelRef={fileMentionPanelRef}
                    />
                  ) : skillMentions.open ? (
                    <ComposerSkillMentionPanel
                      panelRef={skillMentionPanelRef}
                      skillMentions={skillMentions}
                    />
                  ) : null
                }
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
              <div className="inline-flex h-6 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--panel-2)] px-2.5 text-[12px] text-[color:var(--muted)]">
                <Loader2 size={12} className="animate-spin" />
                <span>Pi extension running</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
