import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import {
  howcodeDismissTransientUiEvent,
  useHowcodeKeybindingCommand,
} from '../app-shell/keybinding-events'
import { NativeExtensionDialogCard, ProjectTrustCard } from '../features/native-extensions'
import {
  appToneSubtleClass,
  appTypeCompactWidgetClass,
  appTypeTinyClass,
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

const extensionStatusExpandedStorageKey = 'howcode.extensionStatusExpanded'
const nativeExtensionStyleMarkerOpen = '\u001b]howcode-style;'
const nativeExtensionStyleMarkerClose = '\u0007'
const nativeExtensionBoxGlyphPattern = /([╭╰│─]+)/gu

type ComposerPromptSurfaceProps = ComposerProps & {
  composerPanelRef: RefObject<HTMLDivElement | null>
  mainViewRef: RefObject<HTMLElement | null>
  workspaceFooterRef: RefObject<HTMLElement | null>
  onOpenGitOps: () => void
}

type NativeExtensionOverlayWidgetsProps = {
  widgets: ComposerProps['nativeExtensionWidgets']
}

type NativeExtensionOverlayContentProps = NativeExtensionOverlayWidgetsProps & {
  projectTrust: {
    request: NonNullable<ComposerProps['projectTrustRequest']> | null
    onDecide: (trusted: boolean) => Promise<boolean>
  }
  nativeDialog: {
    request: NonNullable<ComposerProps['nativeExtensionDialogRequest']> | null
    onAnswer: (answer: {
      cancelled?: boolean | undefined
      confirmed?: boolean | undefined
      value?: string | undefined
    }) => Promise<boolean>
  }
}

function readExtensionStatusExpandedPreference() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(extensionStatusExpandedStorageKey) === 'true'
}

function NativeExtensionStatusLine({
  statuses,
}: {
  statuses: ComposerProps['nativeExtensionStatuses']
}) {
  const [expanded, setExpanded] = useState(readExtensionStatusExpandedPreference)
  if (statuses.length === 0) return null

  const toggleExpanded = () => {
    setExpanded((current) => {
      const next = !current
      window.localStorage.setItem(extensionStatusExpandedStorageKey, String(next))
      return next
    })
  }

  return (
    <div className="grid py-1.5">
      <button
        type="button"
        className={cn(
          'grid min-w-0 grid-cols-[34px_minmax(0,1fr)_20px] items-start gap-0 rounded-md px-1 py-0.5 text-left',
          appTypeTinyClass,
          appToneSubtleClass,
        )}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse extension status' : 'Expand extension status'}
        onClick={toggleExpanded}
      >
        <span
          className={cn(
            'inline-flex h-4 w-full shrink-0 items-center justify-end pt-[2px] pr-[6px]',
            appToneSubtleClass,
          )}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span
          className={cn(
            'min-w-0 pt-[2px] pl-px',
            appTypeTinyClass,
            appToneSubtleClass,
            expanded ? 'grid gap-0.5' : 'truncate',
          )}
        >
          {expanded
            ? statuses.map((status) => (
                <span
                  key={status.key}
                  className={cn('truncate', appTypeTinyClass, appToneSubtleClass)}
                >
                  {status.text}
                </span>
              ))
            : statuses.map((status) => status.text).join(' · ')}
        </span>
        <span />
      </button>
    </div>
  )
}

function NativeExtensionOverlayContent({
  nativeDialog,
  projectTrust,
  ...widgetsProps
}: NativeExtensionOverlayContentProps) {
  return (
    <>
      <NativeExtensionOverlayWidgets {...widgetsProps} />
      {projectTrust.request ? (
        <ProjectTrustCard request={projectTrust.request} onDecide={projectTrust.onDecide} />
      ) : null}
      {nativeDialog.request ? (
        <NativeExtensionDialogCard
          request={nativeDialog.request}
          onAnswer={nativeDialog.onAnswer}
        />
      ) : null}
    </>
  )
}

function NativeExtensionWidgetLines({
  widget,
}: {
  widget: ComposerProps['nativeExtensionWidgets'][number]
}) {
  const lineCounts = new Map<string, number>()
  const boxedByExtension = widget.lines.some((line) =>
    stripNativeExtensionStyleMarkers(line).trimStart().startsWith('╭'),
  )
  return (
    <div className="grid gap-0 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-1.5 text-left shadow-none">
      {boxedByExtension ? (
        <pre className="m-0 overflow-hidden truncate whitespace-pre font-mono text-[11.5px] leading-[1rem] text-[color:var(--muted-2)]/88">
          {renderNativeExtensionWidgetLine(widget.lines.join('\n'), { monoBoxGlyphs: false })}
        </pre>
      ) : (
        widget.lines.map((line) => {
          const count = lineCounts.get(line) ?? 0
          lineCounts.set(line, count + 1)
          return (
            <div
              key={`${widget.key}:${count}:${line}`}
              className={cn(
                'truncate whitespace-pre text-[color:var(--muted-2)]/88',
                appTypeCompactWidgetClass,
              )}
            >
              {renderNativeExtensionWidgetLine(line)}
            </div>
          )
        })
      )}
    </div>
  )
}

function stripNativeExtensionStyleMarkers(line: string) {
  let output = ''
  let cursor = 0
  while (cursor < line.length) {
    const markerStart = line.indexOf(nativeExtensionStyleMarkerOpen, cursor)
    if (markerStart < 0) return output + line.slice(cursor)
    output += line.slice(cursor, markerStart)
    const valueStart = markerStart + nativeExtensionStyleMarkerOpen.length
    const markerEnd = line.indexOf(nativeExtensionStyleMarkerClose, valueStart)
    if (markerEnd < 0) return output + line.slice(markerStart)
    cursor = markerEnd + nativeExtensionStyleMarkerClose.length
  }
  return output
}

function renderNativeExtensionWidgetLine(
  line: string,
  options: { monoBoxGlyphs: boolean } = { monoBoxGlyphs: true },
) {
  const segments: Array<{ className?: string | undefined; text: string }> = []
  let cursor = 0
  let className: string | undefined

  while (cursor < line.length) {
    const markerStart = line.indexOf(nativeExtensionStyleMarkerOpen, cursor)
    if (markerStart < 0) break
    if (markerStart > cursor) segments.push({ className, text: line.slice(cursor, markerStart) })
    const valueStart = markerStart + nativeExtensionStyleMarkerOpen.length
    const markerEnd = line.indexOf(nativeExtensionStyleMarkerClose, valueStart)
    if (markerEnd < 0) break
    className = getNativeExtensionStyleClass(line.slice(valueStart, markerEnd))
    cursor = markerEnd + nativeExtensionStyleMarkerClose.length
  }

  if (cursor < line.length) segments.push({ className, text: line.slice(cursor) })
  if (segments.length === 0) return line

  const segmentCounts = new Map<string, number>()
  return segments.flatMap((segment) => {
    const keyBase = `${segment.className ?? 'plain'}:${segment.text}`
    const count = segmentCounts.get(keyBase) ?? 0
    segmentCounts.set(keyBase, count + 1)
    return renderNativeExtensionWidgetSegment(segment, `${count}:${keyBase}`, options)
  })
}

function renderNativeExtensionWidgetSegment(
  segment: { className?: string | undefined; text: string },
  keyPrefix: string,
  options: { monoBoxGlyphs: boolean },
) {
  const parts = segment.text.split(nativeExtensionBoxGlyphPattern)
  const partCounts = new Map<string, number>()
  return parts.map((part) => {
    const count = partCounts.get(part) ?? 0
    partCounts.set(part, count + 1)
    const isBoxGlyph = nativeExtensionBoxGlyphPattern.test(part)
    nativeExtensionBoxGlyphPattern.lastIndex = 0
    return (
      <span
        key={`${keyPrefix}:${count}:${part}`}
        className={cn(segment.className, options.monoBoxGlyphs && isBoxGlyph && 'font-mono')}
      >
        {part}
      </span>
    )
  })
}

function getNativeExtensionStyleClass(marker: string) {
  if (marker === 'reset') return undefined
  if (marker === 'bold:bold') return 'font-medium text-[color:var(--text)]'
  const [kind, name] = marker.split(':')
  if (kind === 'bg') return getNativeExtensionBgClass(name)
  if (kind === 'fg') return getNativeExtensionFgClass(name)
  return undefined
}

function getNativeExtensionFgClass(name: string | undefined) {
  switch (name) {
    case 'accent':
    case 'toolTitle':
    case 'customMessageLabel':
      return 'text-[color:var(--accent)]'
    case 'success':
      return 'text-[color:var(--success,var(--accent))]'
    case 'warning':
      return 'text-[color:var(--warning)]'
    case 'error':
      return 'text-[color:var(--danger)]'
    case 'text':
    case 'customMessageText':
      return 'text-[color:var(--text)]'
    case 'dim':
      return 'text-[color:var(--muted-2)]/70'
    case 'muted':
      return 'text-[color:var(--muted)]/88'
    default:
      return undefined
  }
}

function getNativeExtensionBgClass(name: string | undefined) {
  switch (name) {
    case 'selectedBg':
    case 'customMessageBg':
      return 'bg-[color:var(--surface-hover)] text-[color:var(--text)]'
    default:
      return undefined
  }
}

function NativeExtensionOverlayWidgets({ widgets }: NativeExtensionOverlayWidgetsProps) {
  return (
    <>
      {widgets.map((widget) => (
        <div key={widget.key} className="grid w-full overflow-visible px-4">
          <NativeExtensionWidgetLines widget={widget} />
        </div>
      ))}
    </>
  )
}

function getNativeExtensionShortcutKey(event: KeyboardEvent) {
  if (event.isComposing) return null
  const key = getNativeExtensionShortcutBaseKey(event)
  if (!key) return null
  const modifiers = [
    event.ctrlKey ? 'ctrl' : null,
    event.altKey ? 'alt' : null,
    event.shiftKey ? 'shift' : null,
    event.metaKey ? 'meta' : null,
  ].filter(Boolean)
  return [...modifiers, key].join('+')
}

function getNativeExtensionShortcutBaseKey(event: KeyboardEvent) {
  if (event.code.startsWith('Key')) return event.code.slice(3).toLowerCase()
  if (event.code.startsWith('Digit')) return event.code.slice(5)
  if (event.code === 'ArrowLeft') return 'left'
  if (event.code === 'ArrowRight') return 'right'
  if (event.code === 'ArrowUp') return 'up'
  if (event.code === 'ArrowDown') return 'down'
  if (event.code === 'Escape') return 'escape'
  if (event.code === 'Enter') return 'enter'
  if (event.code === 'Space') return 'space'
  if (event.key.length === 1) return event.key.toLowerCase()
  return event.key.toLowerCase() || null
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
  nativeExtensionDialogRequest,
  nativeExtensionShortcuts,
  nativeExtensionStatuses,
  nativeExtensionWidgets,
  projectTrustRequest,
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
  const nativeExtensionOverlayRef = useRef<HTMLDivElement>(null)
  const showNativeDialog = nativeExtensionDialogRequest !== null
  const showProjectTrust = projectTrustRequest !== null
  const visibleNativeExtensionWidgets = nativeExtensionWidgets.filter(
    (widget) => widget.placement === undefined || widget.placement === 'aboveEditor',
  )
  const showNativeExtensionOverlay =
    showNativeDialog || showProjectTrust || visibleNativeExtensionWidgets.length > 0
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
    overlayRef: nativeExtensionOverlayRef,
    visible: showNativeExtensionOverlay,
    onOverlayHeightChange,
  })

  const extensionRunning = extensionCommandRunning
  const placeholderText = getComposerPlaceholderText({
    activeView,
    composerSendMode,
    errorMessage,
    showAskQuestions: false,
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

  useEffect(() => {
    if (nativeExtensionShortcuts.length === 0) return
    const registeredShortcuts = new Set(
      nativeExtensionShortcuts.map((shortcut) => shortcut.shortcut.toLowerCase()),
    )
    const handleNativeExtensionShortcut = (event: KeyboardEvent) => {
      const shortcut = getNativeExtensionShortcutKey(event)
      if (!(shortcut && registeredShortcuts.has(shortcut))) return
      event.preventDefault()
      event.stopPropagation()
      void runComposerAction('composer.native-extension-shortcut', {
        projectId,
        sessionPath,
        composerMode,
        chatGroupId,
        shortcut,
      })
    }
    window.addEventListener('keydown', handleNativeExtensionShortcut, { capture: true })
    return () =>
      window.removeEventListener('keydown', handleNativeExtensionShortcut, { capture: true })
  }, [
    chatGroupId,
    composerMode,
    nativeExtensionShortcuts,
    projectId,
    runComposerAction,
    sessionPath,
  ])

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
            ref={nativeExtensionOverlayRef}
            className={cn(
              'pointer-events-auto absolute right-0 bottom-full left-0 grid gap-2',
              composerPopoverExtensionLayerClass,
            )}
          >
            <NativeExtensionOverlayContent
              widgets={visibleNativeExtensionWidgets}
              projectTrust={{
                request: projectTrustRequest,
                onDecide: async (trusted) => {
                  return await runComposerAction('composer.set-project-trust', {
                    projectId,
                    sessionPath,
                    composerMode,
                    chatGroupId,
                    trusted,
                  })
                },
              }}
              nativeDialog={{
                request: nativeExtensionDialogRequest,
                onAnswer: async (answer) => {
                  if (!nativeExtensionDialogRequest) return false
                  return await runComposerAction('composer.answer-native-extension-dialog', {
                    projectId,
                    sessionPath,
                    composerMode,
                    chatGroupId,
                    requestId: nativeExtensionDialogRequest.id,
                    ...answer,
                  })
                },
              }}
            />
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
        <NativeExtensionStatusLine statuses={nativeExtensionStatuses} />
      </div>

      <ComposerStopRail
        boundaryRef={stopButtonBoundaryRef}
        canStopComposer={canStopComposer}
        onStop={() => void stop()}
      />
    </div>
  )
}
