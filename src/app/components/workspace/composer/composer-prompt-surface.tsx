import { type RefObject, useRef } from 'react'
import { getPersistedSessionPath } from '../../../../../shared/session-paths'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type { ComposerProps } from '../composer'
import { AskQuestionsCard } from './ask-questions-card'
import { ComposerFooter } from './composer-footer'
import { ComposerPromptInputPanel } from './composer-prompt-input-panel'
import { ComposerAttachmentRail, ComposerStopRail } from './composer-side-controls'
import { useComposerController } from './controller/useComposerController'
import { useAskQuestionsOverlayHeight } from './useAskQuestionsOverlayHeight'
import { useComposerFileMentions } from './useComposerFileMentions'
import {
  useComposerAutocompleteEffects,
  useComposerEscapeEffects,
} from './useComposerPromptSurfaceEffects'
import { useComposerSkillMentions } from './useComposerSkillMentions'
import { useComposerSlashCommands } from './useComposerSlashCommands'
import { useGlobalComposerFileDrop } from './useGlobalComposerFileDrop'

type ComposerPromptSurfaceProps = ComposerProps & {
  composerPanelRef: RefObject<HTMLDivElement | null>
  mainViewRef: RefObject<HTMLElement | null>
  workspaceFooterRef: RefObject<HTMLElement | null>
  onOpenGitOps: () => void
}

function getComposerPlaceholderText(input: {
  activeView: ComposerProps['activeView']
  errorMessage: string | null
  showAskQuestions: boolean
}) {
  if (input.errorMessage) return input.errorMessage
  if (input.showAskQuestions) {
    return 'Type Other · Enter replies · empty Enter advances · ←/→ questions · Esc dismisses'
  }
  if (input.activeView === 'chat' || input.activeView === 'thread') {
    return 'Hover to type · Enter sends · Shift+Enter for a new line'
  }
  return 'Hover to type · / commands · @ files · Enter sends'
}

function isConversationComposerView(activeView: ComposerProps['activeView']) {
  return activeView === 'chat' || activeView === 'thread'
}

export function ComposerPromptSurface({
  activeView,
  composerPanelRef,
  mainViewRef,
  workspaceFooterRef,
  model,
  contextUsage,
  messages,
  availableModels,
  isStreaming,
  replyActivityKey,
  isCompacting,
  isExtensionCommandRunning,
  nativeAskQuestionsRequest,
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
  hoverToFocus,
  hoverToBlur,
  composerSendMode,
  keybindings,
  onOpenTakeoverTerminal,
  onToggleTerminal,
  onToggleArtifacts,
  onOpenSettingsView,
  onRestoredQueuedPromptApplied,
  onListAttachmentEntries,
  onAction,
  terminalVisible,
  preferSideFilePicker = false,
  preferSideModelPopover = false,
  artifactsVisible,
  artifactsAvailable,
  onSetDiffBaseline,
  onOpenGitOps,
  onOverlayHeightChange,
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
  })
  const dictationTranscribing = dictationInterimText.length > 0
  const composerMode = activeView === 'chat' ? 'chat' : 'code'
  const slashCommandPanelRef = useRef<HTMLDivElement>(null)
  const fileMentionPanelRef = useRef<HTMLDivElement>(null)
  const skillMentionPanelRef = useRef<HTMLDivElement>(null)
  const stopButtonBoundaryRef = useRef<HTMLDivElement>(null)
  const askQuestionsOverlayRef = useRef<HTMLDivElement>(null)
  const showAskQuestions = nativeAskQuestionsRequest !== null
  const answerNativeQuestions = async (answers: string[][] | null) => {
    if (!nativeAskQuestionsRequest) return false
    return await runComposerAction('composer.answer-native-questions', {
      projectId,
      sessionPath,
      composerMode,
      chatGroupId,
      requestId: nativeAskQuestionsRequest.id,
      answers,
    })
  }
  const startNewSession = () => {
    void runComposerAction('thread.new', { projectId, chatGroupId, composerMode })
  }
  const slashCommands = useComposerSlashCommands({
    draft,
    projectId,
    sessionPath,
    composerMode,
    setDraft,
    send,
    sendExtensionCommand,
    onOpenSettingsView,
    onStartNewSession: startNewSession,
  })
  const slashCommandListSignature = slashCommands.commands
    .map((command) => `${command.source}:${command.name}`)
    .join('|')
  const skillMentions = useComposerSkillMentions({
    draft,
    projectId,
    sessionPath,
    composerMode,
    setDraft,
  })
  const skillMentionListSignature = skillMentions.skills
    .map((skill) => `${skill.name}:${skill.filePath}`)
    .join('|')
  const fileMentions = useComposerFileMentions({
    draft,
    projectId,
    setDraft,
    attachAttachments: attachPickerAttachments,
  })
  const fileMentionListSignature = fileMentions.files
    .map((file) => `${file.kind}:${file.path}`)
    .join('|')

  useComposerAutocompleteEffects({
    composerPanelRef,
    fileMentionPanelRef,
    fileMentionListSignature,
    fileMentions,
    skillMentionPanelRef,
    skillMentionListSignature,
    skillMentions,
    slashCommandPanelRef,
    slashCommandListSignature,
    slashCommands,
    stopButtonBoundaryRef,
  })

  useComposerEscapeEffects({
    cancelDictation,
    dictationActive,
    dictationTranscribing,
    pickerOpen,
    setOpenMenu,
  })

  useGlobalComposerFileDrop(handleDrop)

  useAskQuestionsOverlayHeight({
    overlayRef: askQuestionsOverlayRef,
    visible: showAskQuestions,
    onOverlayHeightChange,
  })

  const extensionRunning = extensionCommandRunning
  const askQuestionsArrowNavigationRef = useRef<
    ((direction: 'previous' | 'next') => boolean) | null
  >(null)
  const askQuestionsSubmitRef = useRef<(() => boolean) | null>(null)
  const placeholderText = getComposerPlaceholderText({ activeView, errorMessage, showAskQuestions })
  const attachmentButtonLabel = attachments.length > 0 ? 'Manage attachments' : 'Add attachment'
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  const canStopComposer = (composerIsStreaming || extensionRunning) && !isSending && !!sessionPath

  useHowcodeKeybindingCommand('composer.submit', (event) => {
    event.preventDefault()
    void send()
  })
  useHowcodeKeybindingCommand('dictation.toggle', (event) => {
    if (!showDictationButton) return
    event.preventDefault()
    void toggleDictation()
  })

  return (
    <div
      className="relative grid w-full grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-2 overflow-visible"
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

      <div className="relative grid gap-0 overflow-visible">
        {showAskQuestions ? (
          <div
            ref={askQuestionsOverlayRef}
            className="pointer-events-auto absolute right-0 bottom-full left-0 z-20"
          >
            <AskQuestionsCard
              composerDraft={draft}
              questions={nativeAskQuestionsRequest.questions}
              onUseComposerDraft={() => {
                const value = draft
                setDraft('')
                return value
              }}
              onAnswered={async (answers) => {
                const ok = await answerNativeQuestions(answers)
                if (ok) setDraft('')
                return ok
              }}
              onDismiss={() => {
                return answerNativeQuestions(null)
              }}
              registerArrowNavigation={(handler) => {
                askQuestionsArrowNavigationRef.current = handler
              }}
              registerComposerSubmit={(handler) => {
                askQuestionsSubmitRef.current = handler
              }}
            />
          </div>
        ) : null}
        <section
          ref={composerPanelRef}
          className="grid gap-0 overflow-visible rounded-[20px] border border-[color:var(--accent-border)] bg-[color:var(--panel)] shadow-none"
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
              pickerButtonRef={pickerButtonRef}
              pickerPanelRef={pickerPanelRef}
              preferSideFilePicker={preferSideFilePicker}
              pickerState={pickerState}
              placeholderText={placeholderText}
              projectId={projectId}
              slashCommandPanelRef={slashCommandPanelRef}
              slashCommands={slashCommands}
              fileMentionPanelRef={fileMentionPanelRef}
              fileMentions={fileMentions}
              skillMentionPanelRef={skillMentionPanelRef}
              skillMentions={skillMentions}
              showDictationButton={showDictationButton}
              attachPickerAttachments={attachPickerAttachments}
              cancelDictation={cancelDictation}
              handlePaste={handlePaste}
              hoverToFocus={hoverToFocus}
              hoverToBlur={hoverToBlur}
              composerSendMode={composerSendMode}
              keybindings={keybindings}
              hoverBoundaryRef={composerPanelRef}
              onAction={onAction}
              onOpenSettingsView={onOpenSettingsView}
              openPickerDirectory={openPickerDirectory}
              openPickerRoot={openPickerRoot}
              removeAttachment={removeAttachment}
              setDraft={setDraft}
              toggleDictation={toggleDictation}
              togglePendingPickerAttachment={togglePendingPickerAttachment}
              onSubmitOverride={
                showAskQuestions ? () => askQuestionsSubmitRef.current?.() ?? true : undefined
              }
              onEscapeOverride={
                showAskQuestions
                  ? () => {
                      void answerNativeQuestions(null)
                      return true
                    }
                  : undefined
              }
              onArrowNavigationOverride={
                showAskQuestions
                  ? (direction) => askQuestionsArrowNavigationRef.current?.(direction) ?? true
                  : undefined
              }
            />
          </div>
          {errorMessage ? (
            <output className="sr-only" aria-live="polite">
              {errorMessage}
            </output>
          ) : null}
          <div className="h-px bg-[color:var(--border)]" />
          <ComposerFooter
            availableModels={availableModels}
            availableThinkingLevels={availableThinkingLevels}
            composerPanelRef={composerPanelRef}
            diffBaseline={diffBaseline}
            model={model}
            contextUsage={contextUsage}
            messages={messages}
            compactDisabled={isStreaming || isCompacting || !sessionPath}
            isCompacting={isCompacting}
            modelButtonRef={modelButtonRef}
            modelMenuOpen={modelMenuOpen}
            modelMenuRef={modelMenuRef}
            preferSideModelPopover={preferSideModelPopover}
            onOpenGitOps={onOpenGitOps}
            onOpenTakeoverTerminal={onOpenTakeoverTerminal}
            onSelectBaseline={onSetDiffBaseline}
            onSelectModel={(availableModel) => {
              if (isConversationComposerView(activeView) && !persistedSessionPath) {
                void runComposerAction(
                  'settings.update',
                  {
                    key: composerMode === 'chat' ? 'chatModel' : 'codeModel',
                    provider: availableModel.provider,
                    modelId: availableModel.id,
                  },
                  { closeMenu: false },
                )
                return
              }

              void runComposerAction(
                'composer.model',
                {
                  provider: availableModel.provider,
                  modelId: availableModel.id,
                  projectId,
                  sessionPath,
                },
                { closeMenu: false },
              )
            }}
            onSelectThinkingLevel={(level) => {
              if (isConversationComposerView(activeView) && !persistedSessionPath) {
                void runComposerAction('settings.update', {
                  key: composerMode === 'chat' ? 'chatThinkingLevel' : 'codeThinkingLevel',
                  value: level,
                })
                return
              }

              void runComposerAction('composer.thinking', {
                level,
                projectId,
                sessionPath,
              })
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
