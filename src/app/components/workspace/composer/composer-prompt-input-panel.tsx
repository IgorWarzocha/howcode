import { Loader2 } from 'lucide-react'
import type { ClipboardEvent, RefObject } from 'react'
import type { ComposerSendMode, KeybindingOverrides } from '../../../../../shared/keybindings'
import type { ComposerAttachment, DesktopActionInvoker } from '../../../desktop/types'
import { getPathForFileQuery } from '../../../query/desktop-query'
import type { SettingsOpenTarget } from '../../../views/settings/settingsTypes'
import { ComposerDictationControls } from './composer-dictation-controls'
import { ComposerFileMentionPanel } from './composer-file-mention-panel'
import { ComposerFilePicker } from './composer-file-picker'
import {
  getComposerAttachmentsFromClipboardData,
  hasAttachmentHintInClipboardData,
} from './composer-paste-attachments'
import { ComposerSkillMentionPanel } from './composer-skill-mention-panel'
import { SlashCommandPanel } from './composer-slash-command-panel'
import { ComposerTextField } from './composer-text-field'
import { handleComposerTextKeyDown } from './composer-text-keydown'
import type { ComposerFileMentions } from './useComposerFileMentions'
import type { ComposerSkillMentions } from './useComposerSkillMentions'
import type { ComposerSlashCommands } from './useComposerSlashCommands'

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
  composerSendMode: ComposerSendMode
  keybindings: KeybindingOverrides
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
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
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
  composerSendMode,
  keybindings,
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
                    composerSendMode,
                    keybindings,
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
                trailingAdornmentEnabled={showDictationButton}
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
