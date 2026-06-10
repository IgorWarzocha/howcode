import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import type { ComposerSendMode, KeybindingOverrides } from '@howcode/shared/keybindings'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { type ClipboardEvent, type MutableRefObject, type RefObject, useRef } from 'react'
import type { ComposerAttachment, DesktopActionInvoker } from '../desktop/types'
import { getPathForFileQuery } from '../query/desktop-query'
import { appTypeSmallClass, composerInlineStatusPillClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { ComposerDictationControls } from './composer-dictation-controls'
import { ComposerFileMentionPanel } from './composer-file-mention-panel'
import { ComposerFilePicker } from './composer-file-picker'
import {
  getComposerAttachmentsFromClipboardData,
  hasAttachmentHintInClipboardData,
} from './composer-paste-attachments'
import { ComposerPromptPopoverStack } from './composer-prompt-popover-stack'
import { ComposerSkillMentionPanel } from './composer-skill-mention-panel'
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
  preferPortalFilePicker?: boolean
  pickerState: Parameters<typeof ComposerFilePicker>[0]['picker']
  placeholderText: string
  projectId: string
  piTreeFilterMode?: PiTreeFilterMode | undefined
  sessionPath?: string | null | undefined
  sessionTreeOpen?: boolean | undefined
  sessionTreePanelRef?: RefObject<HTMLDivElement | null> | undefined
  sessionTreeForceHidden?: boolean | undefined
  sessionTreeNavigateDisabled?: boolean | undefined
  onSessionTreeNavigate?:
    | ((entryId: string, summarize: boolean, label?: string) => Promise<boolean>)
    | undefined
  onSessionTreeLabel?: ((entryId: string, label: string) => Promise<boolean> | boolean) | undefined
  onRevealSessionTreeEntryInThread?: ((entryId: string) => void) | undefined
  onBindSessionTreeClose?: ((close: (() => void) | null) => void) | undefined
  onSessionTreeNavigateConfirmOpenChange?: ((open: boolean) => void) | undefined
  onSessionTreeLabelPopoverOpenChange?: ((open: boolean) => void) | undefined
  sessionTreeCancelNavigateConfirmRef?: MutableRefObject<(() => void) | null> | undefined
  sessionTreeCancelLabelPopoverRef?: MutableRefObject<(() => void) | null> | undefined
  composerPopoverStackRef?: RefObject<HTMLDivElement | null> | undefined
  onSessionTreeTypingDismiss?: (() => void) | undefined
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

function isBranchGuardError(errorMessage: string | null) {
  return Boolean(errorMessage?.includes('then resend your prompt.'))
}

function getComposerStatusMessage(input: {
  draft: string
  errorMessage: string | null
  showBranchGuardPopup: boolean
}) {
  if (!(input.errorMessage && input.draft.length > 0)) return null
  return input.showBranchGuardPopup ? null : input.errorMessage
}

function BranchGuardPopup({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none absolute right-4 bottom-full left-[1.1rem] z-[5] mb-2 flex justify-center">
      <div
        className={cn(
          'thread-compaction-pill inline-flex h-7 max-w-full shrink-0 items-center gap-1.5 rounded-full px-3 text-[color:var(--danger)]',
          appTypeSmallClass,
        )}
      >
        <AlertTriangle size={12} className="shrink-0" />
        <span className="truncate">{message}</span>
      </div>
    </div>
  )
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: single surface wiring dictation, mentions, and popovers
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
  preferPortalFilePicker = false,
  pickerState,
  placeholderText,
  projectId,
  piTreeFilterMode = 'no-tools',
  sessionPath = null,
  sessionTreeOpen = false,
  sessionTreePanelRef: sessionTreePanelRefProp,
  sessionTreeForceHidden = false,
  sessionTreeNavigateDisabled = false,
  onSessionTreeNavigate,
  onSessionTreeLabel,
  onRevealSessionTreeEntryInThread,
  onBindSessionTreeClose,
  onSessionTreeNavigateConfirmOpenChange,
  onSessionTreeLabelPopoverOpenChange,
  sessionTreeCancelNavigateConfirmRef,
  sessionTreeCancelLabelPopoverRef,
  composerPopoverStackRef,
  onSessionTreeTypingDismiss,
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
  const internalSessionTreePanelRef = useRef<HTMLDivElement>(null)
  const sessionTreePanelRef = sessionTreePanelRefProp ?? internalSessionTreePanelRef
  const showBranchGuardPopup = isBranchGuardError(errorMessage)
  const statusMessage = getComposerStatusMessage({ draft, errorMessage, showBranchGuardPopup })
  const dictationButtonVisible = showDictationButton && !inputLocked

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
          preferPortalPlacement={preferPortalFilePicker}
          projectRootPath={projectId}
          onAttachAttachments={attachPickerAttachments}
          onOpenRoot={openPickerRoot}
          onOpenDirectory={openPickerDirectory}
          onRemoveAttachment={removeAttachment}
          onToggleFile={togglePendingPickerAttachment}
        />
      ) : null}
      <div className="relative grid content-end pr-4 pl-[1.1rem] pt-4 pb-1">
        <BranchGuardPopup message={showBranchGuardPopup ? errorMessage : null} />
        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2">
            <div className="min-w-0 flex-1">
              <ComposerPromptPopoverStack
                sessionPath={sessionPath}
                sessionTreeOpen={sessionTreeOpen}
                treeFilterMode={piTreeFilterMode}
                sessionTreePanelRef={sessionTreePanelRef}
                popoverStackRef={composerPopoverStackRef}
                sessionTreeForceHidden={sessionTreeForceHidden}
                sessionTreeNavigateDisabled={sessionTreeNavigateDisabled}
                onSessionTreeNavigate={onSessionTreeNavigate}
                onSessionTreeLabel={onSessionTreeLabel}
                onRevealSessionTreeEntryInThread={onRevealSessionTreeEntryInThread}
                onBindSessionTreeClose={onBindSessionTreeClose}
                onSessionTreeNavigateConfirmOpenChange={onSessionTreeNavigateConfirmOpenChange}
                onSessionTreeLabelPopoverOpenChange={onSessionTreeLabelPopoverOpenChange}
                sessionTreeCancelNavigateConfirmRef={sessionTreeCancelNavigateConfirmRef}
                sessionTreeCancelLabelPopoverRef={sessionTreeCancelLabelPopoverRef}
                slashCommandPanelRef={slashCommandPanelRef}
                slashCommands={slashCommands}
              />
              <ComposerTextField
                value={draft}
                onChange={(next) => {
                  if (sessionTreeOpen) onSessionTreeTypingDismiss?.()
                  setDraft(next)
                }}
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
                statusMessage={statusMessage}
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
                endAdornment={
                  extensionRunning ? (
                    <div className={composerInlineStatusPillClass}>
                      <Loader2 size={12} className="shrink-0 animate-spin" />
                      <span className="truncate">Pi extension running</span>
                    </div>
                  ) : null
                }
                trailingAdornmentEnabled={dictationButtonVisible}
                trailingAdornment={
                  <ComposerDictationControls
                    dictationActive={dictationActive}
                    dictationMissingModel={dictationMissingModel}
                    dictationSupported={dictationSupported}
                    dictationTranscribing={dictationTranscribing}
                    placement="trailing"
                    onAction={onAction}
                    onOpenSettingsView={onOpenSettingsView}
                    showDictationButton={dictationButtonVisible}
                    toggleDictation={toggleDictation}
                  />
                }
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
