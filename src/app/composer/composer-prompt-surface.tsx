import { composerPanelClass } from '@howaboua/howcode-sdk/ui/classes'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { type RefObject, useRef } from 'react'
import { WORKSPACE_RAIL_GRID_CLASS } from '../ui/layout'
import type { ComposerProps } from './composer-contract'
import { ComposerPromptFooter } from './composer-prompt-footer'
import { ComposerPromptInputPanel } from './composer-prompt-input-panel'
import { ComposerPromptOverlays } from './composer-prompt-overlays'
import { getComposerPlaceholderText } from './composer-prompt-surface-helpers'
import { ComposerAttachmentRail, ComposerStopRail } from './composer-side-controls'
import { useComposerController } from './controller/useComposerController'
import { useComposerChatOverlayHeight } from './useComposerChatOverlayHeight'
import { useComposerGlobalCommands } from './useComposerGlobalCommands'
import { useComposerPromptAutocomplete } from './useComposerPromptAutocomplete'
import { useComposerEscapeEffects } from './useComposerPromptSurfaceEffects'
import { useGlobalComposerFileDrop } from './useGlobalComposerFileDrop'

type ComposerPromptSurfaceProps = ComposerProps & {
  composerPanelRef: RefObject<HTMLDivElement | null>
}

function hasComposerOverlayAbove(...visibleFlags: boolean[]) {
  return visibleFlags.some(Boolean)
}

export function ComposerPromptSurface({
  activeView,
  composerProfile = 'coding',
  composerPanelRef,
  runtime,
  messages,
  isStreaming,
  replyActivityKey,
  streamingBehaviorPreference,
  directoryId,
  workspaceId,
  directoryGitState,
  parentBranchName,
  diffBaseline,
  conversationId,
  dictationModelId,
  dictationMaxDurationSeconds,
  favoriteFolders,
  showDictationButton,
  hoverToFocus,
  hoverToBlur,
  composerSendMode,
  keybindings,
  onToggleTerminal,
  onToggleArtifacts,
  onOpenSettingsView,
  onListAttachmentEntries,
  onAction,
  terminalVisible,
  preferPortalModelPopover = false,
  artifactsVisible,
  artifactsAvailable,
  onSetDiffBaseline,
  onOverlayHeightChange,
  showTerminalControls = true,
}: ComposerPromptSurfaceProps) {
  const { isCompacting } = runtime
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
    setDraft,
    setOpenMenu,
    stop,
    toggleDictation,
    hasDictationSession,
    attachPickerAttachments,
    handleDrop,
    togglePendingPickerAttachment,
    handlePaste,
  } = useComposerController({
    activeView,
    composerProfile,
    directoryId,
    workspaceId,
    conversationId,
    dictationModelId,
    dictationMaxDurationSeconds,
    isStreaming,
    replyActivityKey,
    isCompacting,
    streamingBehaviorPreference,
    onAction,
    onListAttachmentEntries,
  })
  const dictationTranscribing = dictationInterimText.length > 0
  const stopButtonBoundaryRef = useRef<HTMLDivElement>(null)
  const composerOverlayStackRef = useRef<HTMLDivElement>(null)
  const attachmentsTopRounded = true
  const inputPopoversTopRounded = !pickerOpen
  const startNewSession = () => {
    void runComposerAction('chat.new', { directoryId, workspaceId, composerProfile })
  }
  const {
    composerPopoverStackRef,
    dismissConversationFork,
    fileMentionPanelRef,
    fileMentions,
    openConversationFork,
    conversationForkOpen,
    conversationForkPanelRef,
    skillMentionPanelRef,
    skillMentions,
    slashCommandPanelRef,
    slashCommands,
  } = useComposerPromptAutocomplete({
    attachAttachments: attachPickerAttachments,
    composerProfile,
    composerPanelRef,
    draft,
    onOpenSettingsView,
    onStartNewSession: startNewSession,
    directoryId,
    send,
    conversationId,
    setDraft,
    stopButtonBoundaryRef,
  })

  const closeConversationFork = dismissConversationFork

  useComposerEscapeEffects({
    cancelDictation,
    dictationActive,
    dictationTranscribing,
    pickerOpen,
    conversationForkOpen,
    onCloseConversationFork: closeConversationFork,
    setOpenMenu,
  })

  useGlobalComposerFileDrop(handleDrop)

  const placeholderText = getComposerPlaceholderText({
    activeView,
    composerSendMode,
    errorMessage,
    showAskQuestions: false,
  })
  const attachmentButtonLabel = attachments.length > 0 ? 'Manage attachments' : 'Add attachment'
  const forkDisabled = !conversationId || isSending || isCompacting
  const handleFork = async (targetEntryId: string) => {
    const ok = await runComposerAction(
      'composer.conversation.fork',
      { directoryId, conversationId: conversationId, composerProfile, workspaceId, targetEntryId },
      { closeMenu: false },
    )
    if (ok) closeConversationFork()
    return ok
  }
  const showPromptOverlays = conversationForkOpen || slashCommands.open
  useComposerChatOverlayHeight({
    overlayRef: composerOverlayStackRef,
    overlayVisible: hasComposerOverlayAbove(pickerOpen, showPromptOverlays),
    popoverStackRef: composerPopoverStackRef,
    popoverStackVisible: false,
    onOverlayHeightChange,
  })

  const composerWorking = composerIsStreaming
  const canStopComposer = composerWorking && !isSending && !!conversationId
  useComposerGlobalCommands({
    closeConversationFork,
    composerPanelRef,
    composerWorking,
    fileMentions,
    inputLocked,
    openConversationFork,
    send,
    setOpenMenu,
    showDictationButton,
    skillMentions,
    slashCommands,
    toggleDictation,
    hasDictationSession,
  })

  return (
    <div
      className={cn('relative grid w-full items-end overflow-visible', WORKSPACE_RAIL_GRID_CLASS)}
      data-composer-root="true"
    >
      <ComposerAttachmentRail
        attachmentCount={attachments.length}
        attachmentButtonLabel={attachmentButtonLabel}
        pickerButtonRef={pickerButtonRef}
        onClearAttachments={clearAttachments}
        onPickAttachments={() => {
          if (slashCommands.open) {
            slashCommands.dismiss({ clearDraft: true })
          }
          pickAttachments()
        }}
      />

      <div className="relative grid gap-0 overflow-visible [container-type:inline-size]">
        <ComposerPromptOverlays
          stackRef={composerOverlayStackRef}
          attachments={{
            visible: pickerOpen,
            topRounded: attachmentsTopRounded,
            anchorRef: pickerButtonRef,
            attachments,
            errorMessage,
            favoriteFolders,
            loading: pickerLoading,
            picker: pickerState,
            panelRef: pickerPanelRef,
            directoryRootPath: directoryId,
            onAttachAttachments: attachPickerAttachments,
            onOpenRoot: openPickerRoot,
            onOpenDirectory: openPickerDirectory,
            onRemoveAttachment: removeAttachment,
            onToggleFile: togglePendingPickerAttachment,
          }}
          prompts={{
            visible: showPromptOverlays,
            conversationId,
            conversationForkOpen,
            onCloseConversationFork: closeConversationFork,
            conversationForkPanelRef,
            popoverStackRef: composerPopoverStackRef,
            forkDisabled,
            onFork: handleFork,
            slashCommandPanelRef,
            slashCommands,
            topRounded: inputPopoversTopRounded,
          }}
        />
        <section
          ref={composerPanelRef}
          className={cn(
            composerPanelClass,
            'motion-composer-panel-pulse',
            composerWorking && 'motion-composer-panel-pulse-active',
          )}
          aria-label="Composer panel"
        >
          {/* Let the prompt column size itself to one line by default, then grow upward naturally as
              the textarea expands. */}
          <div className="relative">
            {/* The prompt surface keeps prompt text and trailing controls in one shared block so it
                still mirrors the git-ops composer shell while attachments live beside it. */}
            <ComposerPromptInputPanel
              clearError={clearError}
              dictationActive={dictationActive}
              dictationMissingModel={dictationMissingModel}
              dictationSupported={dictationSupported}
              dictationTranscribing={dictationTranscribing}
              draft={draft}
              errorMessage={errorMessage}
              inputLocked={inputLocked}
              placeholderText={placeholderText}
              slashCommands={slashCommands}
              fileMentionPanelRef={fileMentionPanelRef}
              fileMentions={fileMentions}
              skillMentionPanelRef={skillMentionPanelRef}
              skillMentions={skillMentions}
              showDictationButton={showDictationButton}
              cancelDictation={cancelDictation}
              handlePaste={handlePaste}
              hoverToFocus={hoverToFocus}
              hoverToBlur={hoverToBlur}
              composerSendMode={composerSendMode}
              keybindings={keybindings}
              hoverBoundaryRef={composerPanelRef}
              onAction={onAction}
              onOpenSettingsView={onOpenSettingsView}
              setDraft={(next) => {
                if (conversationForkOpen) closeConversationFork()
                setDraft(next)
              }}
              toggleDictation={toggleDictation}
            />
          </div>
          {errorMessage ? (
            <output className="sr-only" aria-live="polite">
              {errorMessage}
            </output>
          ) : null}
          <ComposerPromptFooter
            activeView={activeView}
            composerProfile={composerProfile}
            artifactsAvailable={artifactsAvailable}
            artifactsVisible={artifactsVisible}
            compact={compact}
            composerPanelRef={composerPanelRef}
            diffBaseline={diffBaseline}
            isStreaming={isStreaming}
            messages={messages}
            modelButtonRef={modelButtonRef}
            modelMenuOpen={modelMenuOpen}
            modelMenuRef={modelMenuRef}
            onSetDiffBaseline={onSetDiffBaseline}
            onToggleArtifacts={onToggleArtifacts}
            onToggleTerminal={onToggleTerminal}
            parentBranchName={parentBranchName}
            preferPortalModelPopover={preferPortalModelPopover}
            directoryGitState={directoryGitState}
            directoryId={directoryId}
            runComposerAction={runComposerAction}
            runtime={runtime}
            conversationId={conversationId}
            setOpenMenu={setOpenMenu}
            showTerminalControls={showTerminalControls}
            terminalVisible={terminalVisible}
          />
        </section>
      </div>

      <ComposerStopRail
        boundaryRef={stopButtonBoundaryRef}
        canStopComposer={canStopComposer}
        onStop={() => void stop()}
      />
    </div>
  )
}
