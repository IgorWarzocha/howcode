import { type RefObject, useCallback, useRef, useState } from 'react'

import { composerPanelClass } from '../ui/classes'
import { WORKSPACE_RAIL_GRID_CLASS } from '../ui/layout'
import { cn } from '../utils/cn'
import type { ComposerProps } from './composer'
import {
  PiExtensionStatusLine,
  useComposerExtensionStatusFooterOffset,
} from './composer-pi-extension-overlay'
import { ComposerPromptFooter } from './composer-prompt-footer'
import { ComposerPromptInputPanel } from './composer-prompt-input-panel'
import { ComposerPromptOverlays } from './composer-prompt-overlays'
import { getComposerPlaceholderText } from './composer-prompt-surface-helpers'
import { ComposerAttachmentRail, ComposerStopRail } from './composer-side-controls'
import { useComposerController } from './controller/useComposerController'
import { useComposerGlobalCommands } from './useComposerGlobalCommands'
import { useComposerPiExtensionShortcuts } from './useComposerPiExtensionShortcuts'
import { useComposerPromptAutocomplete } from './useComposerPromptAutocomplete'
import { useComposerEscapeEffects } from './useComposerPromptSurfaceEffects'
import { useComposerSessionTreeNavigate } from './useComposerSessionTreeNavigate'
import { useComposerThreadOverlayHeight } from './useComposerThreadOverlayHeight'
import { useGlobalComposerFileDrop } from './useGlobalComposerFileDrop'

type ComposerPromptSurfaceProps = ComposerProps & {
  composerPanelRef: RefObject<HTMLDivElement | null>
  onOpenGitOps: () => void
}

function hasComposerOverlayAbove(...visibleFlags: boolean[]) {
  return visibleFlags.some(Boolean)
}

export function ComposerPromptSurface({
  activeView,
  composerPanelRef,
  workspaceFooterRef,
  runtime,
  messages,
  isStreaming,
  replyActivityKey,
  restoredQueuedPrompt,
  streamingBehaviorPreference,
  projectId,
  chatGroupId,
  projectGitState,
  parentBranchName,
  diffBaseline,
  sessionPath,
  dictationModelId,
  dictationMaxDurationSeconds,
  favoriteFolders,
  showDictationButton,
  hoverToFocus,
  hoverToBlur,
  composerSendMode,
  keybindings,
  piTreeFilterMode = 'no-tools',
  onOpenTakeoverTerminal,
  onToggleTerminal,
  onToggleArtifacts,
  onOpenSettingsView,
  onRestoredQueuedPromptApplied,
  onListAttachmentEntries,
  onAction,
  terminalVisible,
  takeoverVisible,
  preferPortalModelPopover = false,
  artifactsVisible,
  artifactsAvailable,
  onSetDiffBaseline,
  onOpenGitOps,
  onOverlayHeightChange,
  showTerminalControls = true,
}: ComposerPromptSurfaceProps) {
  const {
    isCompacting,
    isExtensionCommandRunning,
    piExtensionDialogRequest,
    piExtensionShortcuts,
    piExtensionStatuses,
    piExtensionWidgets,
    projectTrustRequest,
  } = runtime
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
    invokeComposerAction,
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
  } = useComposerController({
    activeView,
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
  })
  const dictationTranscribing = dictationInterimText.length > 0
  const composerHoverToFocus = hoverToFocus && !takeoverVisible
  const composerHoverToBlur = hoverToBlur && !takeoverVisible
  const composerMode = activeView === 'chat' ? 'chat' : 'code'
  const sessionTreeCloseRef = useRef<(() => void) | null>(null)
  const sessionTreeCancelNavigateConfirmRef = useRef<(() => void) | null>(null)
  const sessionTreeCancelLabelPopoverRef = useRef<(() => void) | null>(null)
  const [sessionTreeNavigateConfirmOpen, setSessionTreeNavigateConfirmOpen] = useState(false)
  const [sessionTreeLabelPopoverOpen, setSessionTreeLabelPopoverOpen] = useState(false)
  const stopButtonBoundaryRef = useRef<HTMLDivElement>(null)
  const composerOverlayStackRef = useRef<HTMLDivElement>(null)
  const piExtensionStatusLineRef = useRef<HTMLDivElement>(null)
  const showNativeDialog = piExtensionDialogRequest !== null
  const showProjectTrust = projectTrustRequest !== null
  const visiblePiExtensionWidgets = piExtensionWidgets.filter(
    (widget) => widget.placement === undefined || widget.placement === 'aboveEditor',
  )
  const showPiExtensionOverlay =
    showNativeDialog || showProjectTrust || visiblePiExtensionWidgets.length > 0
  const attachmentsTopRounded = !hasComposerOverlayAbove(showPiExtensionOverlay)
  const inputPopoversTopRounded = !hasComposerOverlayAbove(showPiExtensionOverlay, pickerOpen)
  const startNewSession = () => {
    void runComposerAction('thread.new', { projectId, chatGroupId, composerMode })
  }
  const {
    composerPopoverStackRef,
    dismissSessionTree,
    fileMentionPanelRef,
    fileMentions,
    openSessionTree,
    sessionTreeOpen,
    sessionTreePanelRef,
    skillMentionPanelRef,
    skillMentions,
    slashCommandPanelRef,
    slashCommands,
  } = useComposerPromptAutocomplete({
    attachAttachments: attachPickerAttachments,
    composerMode,
    composerPanelRef,
    draft,
    onOpenSettingsView,
    onStartNewSession: startNewSession,
    projectId,
    send,
    sendExtensionCommand,
    sessionPath,
    setDraft,
    stopButtonBoundaryRef,
  })

  const closeSessionTree = useCallback(() => {
    sessionTreeCloseRef.current?.()
    dismissSessionTree()
  }, [dismissSessionTree])

  useComposerEscapeEffects({
    cancelDictation,
    dictationActive,
    dictationTranscribing,
    pickerOpen,
    sessionTreeOpen,
    sessionTreeNavigateConfirmOpen,
    sessionTreeLabelPopoverOpen,
    onCloseSessionTree: closeSessionTree,
    onCancelSessionTreeNavigateConfirm: () => {
      sessionTreeCancelNavigateConfirmRef.current?.()
      setSessionTreeNavigateConfirmOpen(false)
    },
    onCancelSessionTreeLabelPopover: () => {
      sessionTreeCancelLabelPopoverRef.current?.()
      setSessionTreeLabelPopoverOpen(false)
    },
    setOpenMenu,
  })

  useGlobalComposerFileDrop(handleDrop)

  const extensionRunning = extensionCommandRunning
  const placeholderText = getComposerPlaceholderText({
    activeView,
    composerSendMode,
    errorMessage,
    showAskQuestions: false,
  })
  const attachmentButtonLabel = attachments.length > 0 ? 'Manage attachments' : 'Add attachment'
  const {
    handleSessionTreeLabel,
    handleSessionTreeNavigateAndClose,
    revealSessionTreeEntryInThread,
    sessionTreeForceHidden,
    sessionTreeNavigateDisabled,
  } = useComposerSessionTreeNavigate({
    activeView,
    chatGroupId,
    composerIsStreaming,
    extensionRunning,
    isCompacting,
    isSending,
    onClose: closeSessionTree,
    projectId,
    runComposerAction,
    sessionPath,
  })
  useComposerThreadOverlayHeight({
    extensionOverlayRef: composerOverlayStackRef,
    extensionOverlayVisible:
      showPiExtensionOverlay ||
      pickerOpen ||
      (sessionTreeOpen && !sessionTreeForceHidden) ||
      slashCommands.open,
    popoverStackRef: composerPopoverStackRef,
    popoverStackVisible: false,
    onOverlayHeightChange,
  })

  useComposerExtensionStatusFooterOffset({
    statusLineRef: piExtensionStatusLineRef,
    visible: piExtensionStatuses.length > 0,
    workspaceFooterRef,
  })

  const canStopComposer = (composerIsStreaming || extensionRunning) && !isSending && !!sessionPath
  const composerWorking = composerIsStreaming || extensionRunning
  useComposerGlobalCommands({
    closeSessionTree,
    composerPanelRef,
    composerWorking,
    fileMentions,
    inputLocked,
    openSessionTree,
    send,
    setOpenMenu,
    showDictationButton,
    skillMentions,
    slashCommands,
    toggleDictation,
  })

  useComposerPiExtensionShortcuts({
    chatGroupId,
    composerMode,
    composerPanelRef,
    draft,
    invokeAction: invokeComposerAction,
    overlayRef: composerOverlayStackRef,
    projectId,
    sessionPath,
    setDraft,
    shortcuts: piExtensionShortcuts,
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
          extension={{
            visible: showPiExtensionOverlay,
            chatGroupId,
            composerMode,
            dialogRequest: piExtensionDialogRequest,
            projectId,
            projectTrustRequest,
            runComposerAction,
            sessionPath,
            widgets: visiblePiExtensionWidgets,
          }}
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
            projectRootPath: projectId,
            onAttachAttachments: attachPickerAttachments,
            onOpenRoot: openPickerRoot,
            onOpenDirectory: openPickerDirectory,
            onRemoveAttachment: removeAttachment,
            onToggleFile: togglePendingPickerAttachment,
          }}
          prompts={{
            visible: (sessionTreeOpen && !sessionTreeForceHidden) || slashCommands.open,
            sessionPath,
            sessionTreeOpen,
            treeFilterMode: piTreeFilterMode,
            sessionTreePanelRef,
            popoverStackRef: composerPopoverStackRef,
            sessionTreeForceHidden,
            sessionTreeNavigateDisabled,
            onSessionTreeNavigate: handleSessionTreeNavigateAndClose,
            onSessionTreeLabel: handleSessionTreeLabel,
            onRevealSessionTreeEntryInThread: revealSessionTreeEntryInThread,
            onBindSessionTreeClose: (close) => {
              sessionTreeCloseRef.current = close
            },
            onSessionTreeNavigateConfirmOpenChange: setSessionTreeNavigateConfirmOpen,
            onSessionTreeLabelPopoverOpenChange: setSessionTreeLabelPopoverOpen,
            sessionTreeCancelNavigateConfirmRef,
            sessionTreeCancelLabelPopoverRef,
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
              extensionRunning={extensionRunning}
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
              hoverToFocus={composerHoverToFocus}
              hoverToBlur={composerHoverToBlur}
              composerSendMode={composerSendMode}
              keybindings={keybindings}
              hoverBoundaryRef={composerPanelRef}
              onAction={onAction}
              onOpenSettingsView={onOpenSettingsView}
              setDraft={(next) => {
                if (sessionTreeOpen) closeSessionTree()
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
            onOpenGitOps={onOpenGitOps}
            onOpenTakeoverTerminal={onOpenTakeoverTerminal}
            onSetDiffBaseline={onSetDiffBaseline}
            onToggleArtifacts={onToggleArtifacts}
            onToggleTerminal={onToggleTerminal}
            parentBranchName={parentBranchName}
            preferPortalModelPopover={preferPortalModelPopover}
            projectGitState={projectGitState}
            projectId={projectId}
            runComposerAction={runComposerAction}
            runtime={runtime}
            sessionPath={sessionPath}
            setOpenMenu={setOpenMenu}
            showTerminalControls={showTerminalControls}
            terminalVisible={terminalVisible}
          />
        </section>
        <div ref={piExtensionStatusLineRef}>
          <PiExtensionStatusLine statuses={piExtensionStatuses} />
        </div>
      </div>

      <ComposerStopRail
        boundaryRef={stopButtonBoundaryRef}
        canStopComposer={canStopComposer}
        onStop={() => void stop()}
      />
    </div>
  )
}
