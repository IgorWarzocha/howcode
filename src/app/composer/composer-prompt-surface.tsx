import { createSmartBtwWidgetFromMessages, SmartBtwCard } from '@howcode/extensions'
import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import { type RefObject, useEffect, useRef } from 'react'
import {
  howcodeDismissTransientUiEvent,
  useHowcodeKeybindingCommand,
} from '../app-shell/keybinding-events'
import { AskQuestionsCard, useComposerAskQuestionsActions } from '../features/native-extensions'
import {
  appTypeCodeClass,
  composerPanelClass,
  composerPopoverExtensionLayerClass,
} from '../ui/classes'
import { cn } from '../utils/cn'
import type { ComposerProps } from './composer'
import { ComposerFooter } from './composer-footer'
import { ComposerPromptInputPanel } from './composer-prompt-input-panel'
import {
  getComposerPlaceholderText,
  isConversationComposerView,
} from './composer-prompt-surface-helpers'
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

const digitShortcutPattern = /^Digit[1-9]$/u
const smartBtwWorkingLinePattern = /\b(queued|running|thinking)\b/u

type ComposerPromptSurfaceProps = ComposerProps & {
  composerPanelRef: RefObject<HTMLDivElement | null>
  mainViewRef: RefObject<HTMLElement | null>
  workspaceFooterRef: RefObject<HTMLElement | null>
  onOpenGitOps: () => void
}

type NativeExtensionOverlayWidgetsProps = {
  widgets: ComposerProps['nativeExtensionWidgets']
  smartBtwWidget: ComposerProps['nativeExtensionWidgets'][number] | undefined
  onFoldSmartBtw: () => void
  onPreviousSmartBtw: () => void
  onNextSmartBtw: () => void
  onSelectSmartBtw: (index: number) => void
  onClearSmartBtw: () => void
}

function NativeExtensionOverlayWidgets({
  widgets,
  smartBtwWidget,
  onFoldSmartBtw,
  onPreviousSmartBtw,
  onNextSmartBtw,
  onSelectSmartBtw,
  onClearSmartBtw,
}: NativeExtensionOverlayWidgetsProps) {
  return (
    <>
      {smartBtwWidget ? (
        <SmartBtwCard
          widget={smartBtwWidget}
          onFold={onFoldSmartBtw}
          onPrevious={onPreviousSmartBtw}
          onNext={onNextSmartBtw}
          onSelect={onSelectSmartBtw}
          onClear={onClearSmartBtw}
        />
      ) : null}
      {widgets
        .filter((widget) => widget.key !== 'smart-btw')
        .map((widget) => (
          <div key={widget.key} className="grid w-full overflow-visible px-4">
            <div className="grid gap-1 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-2 text-left shadow-none">
              {widget.lines.map((line) => (
                <div
                  key={`${widget.key}:${line}`}
                  className={cn('truncate text-[color:var(--muted)]', appTypeCodeClass)}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}
    </>
  )
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLInputElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function getSmartBtwCycleShortcut(event: KeyboardEvent, showBtwControls: boolean) {
  if (!showBtwControls || isEditableKeyboardTarget(event.target)) return null
  if (!(event.altKey && event.ctrlKey) || event.metaKey || event.shiftKey) return null
  if (digitShortcutPattern.test(event.code)) return `ctrl+alt+${event.code.slice(-1)}`
  if (event.code === 'ArrowLeft') return 'ctrl+alt+left'
  if (event.code === 'ArrowRight') return 'ctrl+alt+right'
  if (event.code === 'ArrowUp') return 'ctrl+alt+up'
  if (event.code === 'ArrowDown') return 'ctrl+alt+down'
  return null
}

function getSmartBtwModifiedShortcut(event: KeyboardEvent) {
  if (!event.altKey || event.metaKey || event.shiftKey) return null
  if (!event.ctrlKey) return null
  const shortcuts: Partial<Record<string, string>> = {
    ArrowLeft: 'ctrl+alt+left',
    ArrowRight: 'ctrl+alt+right',
    ArrowUp: 'ctrl+alt+up',
    ArrowDown: 'ctrl+alt+down',
    KeyC: 'ctrl+alt+c',
    KeyX: 'ctrl+alt+x',
    KeyZ: 'ctrl+alt+z',
  }
  return shortcuts[event.code] ?? null
}

function getSmartBtwOverlayWidget(input: {
  customMessages: ComposerProps['customMessages']
  widgets: ComposerProps['nativeExtensionWidgets']
}) {
  const liveWidget = input.widgets.find((widget) => widget.key === 'smart-btw')
  const restoredWidget = createSmartBtwWidgetFromMessages(input.customMessages)
  if (liveWidget && isSmartBtwLiveWidgetAhead(liveWidget, restoredWidget)) return liveWidget
  return restoredWidget ?? liveWidget
}

function getSmartBtwSessionCount(widget: ComposerProps['nativeExtensionWidgets'][number]) {
  return widget.lines.filter((line) => line.startsWith('session ')).length
}

function isSmartBtwLiveWidgetAhead(
  liveWidget: ComposerProps['nativeExtensionWidgets'][number],
  restoredWidget: ComposerProps['nativeExtensionWidgets'][number] | undefined,
) {
  if (!restoredWidget) return true
  if (liveWidget.lines.some((line) => smartBtwWorkingLinePattern.test(line))) return true
  return getSmartBtwSessionCount(liveWidget) > getSmartBtwSessionCount(restoredWidget)
}

export function ComposerPromptSurface({
  activeView,
  composerPanelRef,
  mainViewRef,
  workspaceFooterRef,
  model,
  contextUsage,
  messages,
  customMessages,
  availableModels,
  isStreaming,
  replyActivityKey,
  isCompacting,
  isExtensionCommandRunning,
  nativeAskQuestionsRequest,
  nativeExtensionWidgets,
  nativeSmartBtwEnabled,
  thinkingLevel,
  restoredQueuedPrompt,
  streamingBehaviorPreference,
  availableThinkingLevels,
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
  onOpenTakeoverTerminal,
  onToggleTerminal,
  onToggleArtifacts,
  onOpenSettingsView,
  onRestoredQueuedPromptApplied,
  onListAttachmentEntries,
  onAction,
  terminalVisible,
  takeoverVisible,
  preferPortalFilePicker = false,
  preferPortalModelPopover = false,
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
  const visibleNativeExtensionWidgets = nativeExtensionWidgets.filter(
    (widget) => widget.placement === undefined || widget.placement === 'aboveEditor',
  )
  const restoredSmartBtwWidget = getSmartBtwOverlayWidget({
    customMessages,
    widgets: visibleNativeExtensionWidgets,
  })
  const showBtwControls = restoredSmartBtwWidget !== undefined
  const showNativeExtensionOverlay =
    showAskQuestions ||
    visibleNativeExtensionWidgets.length > 0 ||
    restoredSmartBtwWidget !== undefined
  const { answerNativeQuestions } = useComposerAskQuestionsActions({
    chatGroupId,
    composerMode,
    nativeAskQuestionsRequest,
    projectId,
    runComposerAction,
    sessionPath,
  })
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
    visible: showNativeExtensionOverlay,
    onOverlayHeightChange,
  })

  const extensionRunning = extensionCommandRunning
  const askQuestionsArrowNavigationRef = useRef<
    ((direction: 'previous' | 'next') => boolean) | null
  >(null)
  const askQuestionsSubmitRef = useRef<(() => boolean) | null>(null)
  const placeholderText = getComposerPlaceholderText({
    activeView,
    composerSendMode,
    errorMessage,
    showAskQuestions,
  })
  const attachmentButtonLabel = attachments.length > 0 ? 'Manage attachments' : 'Add attachment'
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  const canStopComposer = (composerIsStreaming || extensionRunning) && !isSending && !!sessionPath
  const composerWorking = composerIsStreaming || extensionRunning
  const dismissComposerTransientUi = () => {
    setOpenMenu(null)
    slashCommands.dismiss()
    fileMentions.dismiss()
    skillMentions.dismiss()
  }
  const composeSmartBtw = () => setDraft(draft.trim() ? `${draft.trimEnd()} /btw ` : '/btw ')
  const composeSmartBtwRef = useRef(composeSmartBtw)

  useHowcodeKeybindingCommand('composer.submit', (event) => {
    event.preventDefault()
    void send()
  })
  useHowcodeKeybindingCommand('composer.focus', (event) => {
    event.preventDefault()
    dismissComposerTransientUi()
    const textarea = composerPanelRef.current?.querySelector('textarea')
    if (!(textarea instanceof HTMLTextAreaElement)) return
    textarea.focus()
    const cursorPosition = textarea.value.length
    textarea.setSelectionRange(cursorPosition, cursorPosition)
  })
  useHowcodeKeybindingCommand('dictation.toggle', (event) => {
    if (!(showDictationButton && !inputLocked)) return
    event.preventDefault()
    void toggleDictation()
  })

  useEffect(() => {
    window.addEventListener(howcodeDismissTransientUiEvent, dismissComposerTransientUi)
    return () =>
      window.removeEventListener(howcodeDismissTransientUiEvent, dismissComposerTransientUi)
  })

  const runNativeShortcut = (shortcut: string) => {
    if (!showBtwControls) return
    void runComposerAction('composer.native-extension-shortcut', {
      projectId,
      sessionPath,
      composerMode,
      chatGroupId,
      shortcut,
    })
  }
  const runNativeShortcutRef = useRef(runNativeShortcut)
  const showBtwControlsRef = useRef(showBtwControls)
  composeSmartBtwRef.current = composeSmartBtw
  runNativeShortcutRef.current = runNativeShortcut
  showBtwControlsRef.current = showBtwControls

  useEffect(() => {
    if (!nativeSmartBtwEnabled) return
    if (takeoverVisible) return
    const handleBtwShortcut = (event: KeyboardEvent) => {
      const smartBtwControlsVisible = showBtwControlsRef.current
      const cycleShortcut = getSmartBtwCycleShortcut(event, smartBtwControlsVisible)
      const modifiedShortcut = smartBtwControlsVisible ? getSmartBtwModifiedShortcut(event) : null
      const composeShortcut =
        event.altKey && event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === 'KeyZ'
      if (!(cycleShortcut || modifiedShortcut || composeShortcut)) return
      event.preventDefault()
      event.stopPropagation()
      if (composeShortcut) composeSmartBtwRef.current()
      else runNativeShortcutRef.current(cycleShortcut ?? modifiedShortcut ?? '')
    }
    window.addEventListener('keydown', handleBtwShortcut, { capture: true })
    return () => window.removeEventListener('keydown', handleBtwShortcut, { capture: true })
  }, [nativeSmartBtwEnabled, takeoverVisible])

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
        {showNativeExtensionOverlay ? (
          <div
            ref={askQuestionsOverlayRef}
            className={cn(
              'pointer-events-auto absolute right-0 bottom-full left-0 grid gap-2',
              composerPopoverExtensionLayerClass,
            )}
          >
            <NativeExtensionOverlayWidgets
              widgets={visibleNativeExtensionWidgets}
              smartBtwWidget={restoredSmartBtwWidget}
              onFoldSmartBtw={() => runNativeShortcut('ctrl+alt+down')}
              onPreviousSmartBtw={() => runNativeShortcut('ctrl+alt+left')}
              onNextSmartBtw={() => runNativeShortcut('ctrl+alt+right')}
              onSelectSmartBtw={(index) => runNativeShortcut(`ctrl+alt+${index}`)}
              onClearSmartBtw={() => runNativeShortcut('ctrl+alt+x')}
            />
            {showAskQuestions ? (
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
            ) : null}
          </div>
        ) : null}
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
              preferPortalFilePicker={preferPortalFilePicker}
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
            preferPortalModelPopover={preferPortalModelPopover}
            onOpenGitOps={onOpenGitOps}
            onOpenTakeoverTerminal={onOpenTakeoverTerminal}
            onSelectBaseline={onSetDiffBaseline}
            onSelectModel={(availableModel) => {
              if (isConversationComposerView(activeView) && !persistedSessionPath) {
                return runComposerAction(
                  'settings.update',
                  {
                    key: composerMode === 'chat' ? 'chatModel' : 'codeModel',
                    provider: availableModel.provider,
                    modelId: availableModel.id,
                  },
                  { closeMenu: false },
                )
              }

              return runComposerAction(
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
                return runComposerAction('settings.update', {
                  key: composerMode === 'chat' ? 'chatThinkingLevel' : 'codeThinkingLevel',
                  value: level,
                })
              }

              return runComposerAction('composer.thinking', {
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
            parentBranchName={parentBranchName}
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
