import { Paperclip, Square, X } from 'lucide-react'
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import type { ComposerProps } from '../composer'
import { AskQuestionsCard } from './ask-questions-card'
import { ComposerFooter } from './composer-footer'
import { hasFilePayloadInClipboardData } from './composer-paste-attachments'
import { ComposerPromptInputPanel } from './composer-prompt-input-panel'
import { useComposerController } from './controller/useComposerController'
import { useComposerFileMentions } from './useComposerFileMentions'
import { useComposerSkillMentions } from './useComposerSkillMentions'
import { useComposerSlashCommands } from './useComposerSlashCommands'

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
  onLayoutChange,
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
  const lastAskQuestionsOverlayHeightRef = useRef(0)
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
  const slashCommands = useComposerSlashCommands({
    draft,
    projectId,
    sessionPath,
    composerMode,
    setDraft,
    send,
    sendExtensionCommand,
    onOpenSettingsView,
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

  useEffect(() => {
    if (!(slashCommands.open || fileMentions.open || skillMentions.open)) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (
        !target ||
        slashCommandPanelRef.current?.contains(target) ||
        fileMentionPanelRef.current?.contains(target) ||
        skillMentionPanelRef.current?.contains(target) ||
        composerPanelRef.current?.contains(target) ||
        stopButtonBoundaryRef.current?.contains(target)
      ) {
        return
      }

      if (slashCommands.open) slashCommands.dismiss({ clearDraft: true })
      if (fileMentions.open) fileMentions.dismiss()
      if (skillMentions.open) skillMentions.dismiss()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [composerPanelRef, fileMentions, skillMentions, slashCommands])

  useEffect(() => {
    if (!(slashCommands.open && slashCommands.activeDescendantId)) {
      return
    }

    // Keep the effect tied to command content changes too: the active id can remain
    // `...-0` while filtering swaps the actual first row underneath it.
    void slashCommandListSignature

    const panel = slashCommandPanelRef.current
    const option = panel?.querySelector<HTMLElement>(`#${slashCommands.activeDescendantId}`)
    if (!(panel && option)) {
      return
    }

    if (slashCommands.selectedIndex === 0) {
      panel.scrollTop = 0
      return
    }

    const panelStyles = window.getComputedStyle(panel)
    const paddingTop = Number.parseFloat(panelStyles.paddingTop) || 0
    const paddingBottom = Number.parseFloat(panelStyles.paddingBottom) || 0
    const visibleTop = panel.scrollTop + paddingTop
    const visibleBottom = panel.scrollTop + panel.clientHeight - paddingBottom
    const optionTop = option.offsetTop
    const optionBottom = optionTop + option.offsetHeight

    if (optionTop < visibleTop) {
      panel.scrollTop = optionTop - paddingTop
    } else if (optionBottom > visibleBottom) {
      panel.scrollTop = optionBottom - panel.clientHeight + paddingBottom
    }
  }, [
    slashCommands.open,
    slashCommands.activeDescendantId,
    slashCommands.selectedIndex,
    slashCommandListSignature,
  ])

  useEffect(() => {
    if (!(fileMentions.open && fileMentions.activeDescendantId)) return
    void fileMentionListSignature
    const panel = fileMentionPanelRef.current
    const option = panel?.querySelector<HTMLElement>(`#${fileMentions.activeDescendantId}`)
    if (!(panel && option)) return
    if (fileMentions.selectedIndex === 0) {
      panel.scrollTop = 0
      return
    }
    option.scrollIntoView({ block: 'nearest' })
  }, [
    fileMentionListSignature,
    fileMentions.activeDescendantId,
    fileMentions.open,
    fileMentions.selectedIndex,
  ])

  useEffect(() => {
    if (!(skillMentions.open && skillMentions.activeDescendantId)) {
      return
    }

    void skillMentionListSignature

    const panel = skillMentionPanelRef.current
    const option = panel?.querySelector<HTMLElement>(`#${skillMentions.activeDescendantId}`)
    if (!(panel && option)) return

    if (skillMentions.selectedIndex === 0) {
      panel.scrollTop = 0
      return
    }

    option.scrollIntoView({ block: 'nearest' })
  }, [
    skillMentionListSignature,
    skillMentions.activeDescendantId,
    skillMentions.open,
    skillMentions.selectedIndex,
  ])

  useEffect(() => {
    if (!(pickerOpen || dictationActive || dictationTranscribing)) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (pickerOpen) {
        event.preventDefault()
        event.stopImmediatePropagation()
        setOpenMenu(null)
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      void cancelDictation()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [cancelDictation, dictationActive, dictationTranscribing, pickerOpen, setOpenMenu])

  useEffect(() => {
    const handleGlobalFileDrag = (event: DragEvent) => {
      if (!hasFilePayloadInClipboardData(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleGlobalDrop = (event: DragEvent) => {
      if (!hasFilePayloadInClipboardData(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      void handleDrop(event.dataTransfer)
    }

    window.addEventListener('dragenter', handleGlobalFileDrag, true)
    window.addEventListener('dragover', handleGlobalFileDrag, true)
    window.addEventListener('drop', handleGlobalDrop, true)

    return () => {
      window.removeEventListener('dragenter', handleGlobalFileDrag, true)
      window.removeEventListener('dragover', handleGlobalFileDrag, true)
      window.removeEventListener('drop', handleGlobalDrop, true)
    }
  }, [handleDrop])

  useLayoutEffect(() => {
    if (!showAskQuestions) {
      if (lastAskQuestionsOverlayHeightRef.current !== 0) {
        lastAskQuestionsOverlayHeightRef.current = 0
        onOverlayHeightChange?.(0)
      }
      return
    }

    const overlay = askQuestionsOverlayRef.current
    if (!overlay) return

    const reportIfChanged = () => {
      const nextHeight = Math.ceil(overlay.getBoundingClientRect().height)
      if (lastAskQuestionsOverlayHeightRef.current === nextHeight) return
      lastAskQuestionsOverlayHeightRef.current = nextHeight
      onOverlayHeightChange?.(nextHeight)
    }

    reportIfChanged()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(reportIfChanged)
    observer.observe(overlay)
    return () => observer.disconnect()
  }, [onOverlayHeightChange, showAskQuestions])

  const extensionRunning = extensionCommandRunning
  const askQuestionsArrowNavigationRef = useRef<
    ((direction: 'previous' | 'next') => boolean) | null
  >(null)
  const askQuestionsSubmitRef = useRef<(() => boolean) | null>(null)
  const placeholderText = getComposerPlaceholderText({ activeView, errorMessage, showAskQuestions })
  const attachmentButtonLabel = attachments.length > 0 ? 'Manage attachments' : 'Add attachment'
  const canStopComposer = (composerIsStreaming || extensionRunning) && !isSending && !!sessionPath
  return (
    <div className="relative grid w-full grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-2 overflow-visible">
      <div className="relative h-full min-h-[7rem] w-8 shrink-0 self-stretch text-[color:var(--muted)]">
        <div className="absolute bottom-[3.55rem] left-0 flex w-7 flex-col-reverse items-center gap-1">
          {attachments.length > 0 ? (
            <>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--accent-bg)] px-1.5 py-0.5 text-[11px] text-[color:var(--text)]">
                {attachments.length}
              </span>
              <button
                type="button"
                className={cn(
                  compactIconButtonClass,
                  'h-5 w-5 rounded-full opacity-70 hover:opacity-100',
                )}
                onClick={clearAttachments}
                aria-label="Clear attachments"
                data-tooltip="Clear attachments"
              >
                <X size={11} />
              </button>
            </>
          ) : null}
          <button
            ref={pickerButtonRef}
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            onClick={() => {
              if (slashCommands.open) {
                slashCommands.dismiss({ clearDraft: true })
              }
              pickAttachments()
            }}
            aria-label={attachmentButtonLabel}
            data-tooltip={attachmentButtonLabel}
          >
            <span className={cn(compactIconButtonClass, 'h-7 w-7 shrink-0 rounded-full')}>
              <Paperclip size={15} />
            </span>
          </button>
        </div>
      </div>

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
              hoverBoundaryRef={composerPanelRef}
              onAction={onAction}
              onLayoutChange={onLayoutChange}
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
              if (isConversationComposerView(activeView)) {
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
              if (isConversationComposerView(activeView)) {
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

      <div className="relative h-full min-h-[7rem] w-8 shrink-0 self-stretch text-[color:var(--muted)]">
        <div
          ref={stopButtonBoundaryRef}
          className="absolute right-0 bottom-[3.55rem] flex w-7 items-center justify-center"
        >
          <button
            type="button"
            className={cn(
              compactIconButtonClass,
              'h-7 w-7 shrink-0 rounded-full text-[color:var(--danger)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]',
              canStopComposer
                ? 'bg-[color:var(--danger-bg)] opacity-80'
                : 'bg-transparent opacity-25 hover:opacity-45',
            )}
            onClick={() => void stop()}
            disabled={!canStopComposer}
            aria-label="Stop Pi"
            data-tooltip="Stop Pi"
          >
            <Square size={11} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  )
}
