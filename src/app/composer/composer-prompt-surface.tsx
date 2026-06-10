import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import {
  howcodeDismissTransientUiEvent,
  useHowcodeKeybindingCommand,
} from '../app-shell/keybinding-events'
import { PiExtensionDialogCard, ProjectTrustCard } from '../features/pi-extensions'
import { dispatchSessionTreeReveal } from '../thread/session-tree-reveal'

import {
  appToneSubtleClass,
  appTypeCompactWidgetClass,
  appTypeTinyClass,
  composerPanelClass,
  composerPopoverExtensionLayerClass,
  piExtensionTextClass,
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
import { useComposerFileMentions } from './useComposerFileMentions'
import {
  useComposerAutocompleteEffects,
  useComposerEscapeEffects,
} from './useComposerPromptSurfaceEffects'
import { useComposerSessionTreeNavigate } from './useComposerSessionTreeNavigate'
import { useComposerSessionTreePanel } from './useComposerSessionTreePanel'
import { useComposerSkillMentions } from './useComposerSkillMentions'
import { useComposerSlashCommands } from './useComposerSlashCommands'
import { useComposerThreadOverlayHeight } from './useComposerThreadOverlayHeight'
import { useGlobalComposerFileDrop } from './useGlobalComposerFileDrop'

const extensionStatusExpandedStorageKey = 'howcode.extensionStatusExpanded'
const piExtensionFoldedStorageKey = 'howcode.piExtensionFolded'
const piExtensionStyleMarkerOpen = '\u001b]howcode-style;'
const piExtensionStyleMarkerClose = '\u0007'
const piExtensionBoxGlyphPattern = /([╭╰│─]+)/gu
const piExtensionKeySeparatorPattern = /[-_.]+/u

type PiExtensionOverlaySection = {
  id: string
  name: string
  type: 'dialog' | 'widget'
  content: ReactNode
}

type ComposerPromptSurfaceProps = ComposerProps & {
  composerPanelRef: RefObject<HTMLDivElement | null>
  mainViewRef: RefObject<HTMLElement | null>
  workspaceFooterRef: RefObject<HTMLElement | null>
  onOpenGitOps: () => void
}

type PiExtensionOverlayWidgetsProps = {
  widgets: ComposerProps['piExtensionWidgets']
}

type PiExtensionOverlayContentProps = PiExtensionOverlayWidgetsProps & {
  projectTrust: {
    request: NonNullable<ComposerProps['projectTrustRequest']> | null
    onDecide: (trusted: boolean) => Promise<boolean>
  }
  nativeDialog: {
    request: NonNullable<ComposerProps['piExtensionDialogRequest']> | null
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

function readPiExtensionFoldedPreference() {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(piExtensionFoldedStorageKey) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function writePiExtensionFoldedPreference(folded: Set<string>) {
  window.localStorage.setItem(piExtensionFoldedStorageKey, JSON.stringify([...folded]))
}

function getPiExtensionDisplayName(key: string) {
  return key
    .split(piExtensionKeySeparatorPattern)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function PiExtensionStatusLine({ statuses }: { statuses: ComposerProps['piExtensionStatuses'] }) {
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

function PiExtensionOverlayContent({
  nativeDialog,
  projectTrust,
  widgets,
}: PiExtensionOverlayContentProps) {
  const [foldedSections, setFoldedSections] = useState(readPiExtensionFoldedPreference)
  const sections: PiExtensionOverlaySection[] = [
    ...widgets.map((widget) => ({
      id: `widget:${widget.key}`,
      name: getPiExtensionDisplayName(widget.key),
      type: 'widget' as const,
      content: <PiExtensionWidgetLines widget={widget} />,
    })),
    ...(projectTrust.request
      ? [
          {
            id: 'dialog:project-trust',
            name: 'Project trust',
            type: 'dialog' as const,
            content: (
              <ProjectTrustCard
                request={projectTrust.request}
                embedded
                onDecide={projectTrust.onDecide}
              />
            ),
          },
        ]
      : []),
    ...(nativeDialog.request
      ? [
          {
            id: `dialog:${nativeDialog.request.id}`,
            name: 'Extension',
            type: 'dialog' as const,
            content: (
              <PiExtensionDialogCard
                request={nativeDialog.request}
                embedded
                onAnswer={nativeDialog.onAnswer}
              />
            ),
          },
        ]
      : []),
  ]

  if (sections.length === 0) return null

  const toggleSection = (sectionId: string) => {
    setFoldedSections((current) => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      writePiExtensionFoldedPreference(next)
      return next
    })
  }

  return (
    <div className="grid w-full overflow-visible px-4">
      <div className="grid rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] text-left shadow-none">
        {sections.map((section, index) => (
          <PiExtensionOverlaySection
            key={section.id}
            section={section}
            folded={foldedSections.has(section.id)}
            divided={index > 0}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>
    </div>
  )
}

function PiExtensionOverlaySection({
  divided,
  folded,
  onToggle,
  section,
}: {
  divided: boolean
  folded: boolean
  onToggle: () => void
  section: PiExtensionOverlaySection
}) {
  if (!folded) {
    return (
      <section className={cn('relative', divided && 'border-t border-[color:var(--border)]/70')}>
        <button
          type="button"
          className={cn(
            'absolute top-1 right-2 z-10 inline-flex h-5 w-5 items-center justify-center text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]',
            piExtensionTextClass,
          )}
          aria-expanded
          aria-label={`Collapse ${section.name}`}
          onClick={onToggle}
        >
          <ChevronDown size={13} />
        </button>
        <div className="px-3 py-1.5">{section.content}</div>
      </section>
    )
  }

  return (
    <section className={cn('relative', divided && 'border-t border-[color:var(--border)]/70')}>
      <button
        type="button"
        className={cn(
          'grid w-full items-center px-3 py-1.5 pr-9 text-left text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]',
          piExtensionTextClass,
        )}
        aria-expanded={false}
        aria-label={`Expand ${section.name}`}
        onClick={onToggle}
      >
        <span className="truncate">
          {section.name} - {section.type}
        </span>
        <span className="absolute top-1 right-2 inline-flex h-5 w-5 items-center justify-center">
          <ChevronLeft size={13} />
        </span>
      </button>
    </section>
  )
}

function PiExtensionWidgetLines({
  widget,
}: {
  widget: ComposerProps['piExtensionWidgets'][number]
}) {
  const lineCounts = new Map<string, number>()
  const boxedByExtension = widget.lines.some((line) =>
    stripPiExtensionStyleMarkers(line).trimStart().startsWith('╭'),
  )

  if (boxedByExtension) {
    return (
      <pre
        className={cn(
          'm-0 overflow-hidden truncate whitespace-pre text-[11.5px] leading-[1rem] text-[color:var(--muted-2)]/88',
          piExtensionTextClass,
        )}
      >
        {renderPiExtensionWidgetLine(widget.lines.join('\n'), { monoBoxGlyphs: false })}
      </pre>
    )
  }

  return widget.lines.map((line) => {
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
        {renderPiExtensionWidgetLine(line)}
      </div>
    )
  })
}

function stripPiExtensionStyleMarkers(line: string) {
  let output = ''
  let cursor = 0
  while (cursor < line.length) {
    const markerStart = line.indexOf(piExtensionStyleMarkerOpen, cursor)
    if (markerStart < 0) return output + line.slice(cursor)
    output += line.slice(cursor, markerStart)
    const valueStart = markerStart + piExtensionStyleMarkerOpen.length
    const markerEnd = line.indexOf(piExtensionStyleMarkerClose, valueStart)
    if (markerEnd < 0) return output + line.slice(markerStart)
    cursor = markerEnd + piExtensionStyleMarkerClose.length
  }
  return output
}

function renderPiExtensionWidgetLine(
  line: string,
  options: { monoBoxGlyphs: boolean } = { monoBoxGlyphs: true },
) {
  const segments: Array<{ className?: string | undefined; text: string }> = []
  let cursor = 0
  let className: string | undefined

  while (cursor < line.length) {
    const markerStart = line.indexOf(piExtensionStyleMarkerOpen, cursor)
    if (markerStart < 0) break
    if (markerStart > cursor) segments.push({ className, text: line.slice(cursor, markerStart) })
    const valueStart = markerStart + piExtensionStyleMarkerOpen.length
    const markerEnd = line.indexOf(piExtensionStyleMarkerClose, valueStart)
    if (markerEnd < 0) break
    className = getPiExtensionStyleClass(line.slice(valueStart, markerEnd))
    cursor = markerEnd + piExtensionStyleMarkerClose.length
  }

  if (cursor < line.length) segments.push({ className, text: line.slice(cursor) })
  if (segments.length === 0) return line

  const segmentCounts = new Map<string, number>()
  return segments.flatMap((segment) => {
    const keyBase = `${segment.className ?? 'plain'}:${segment.text}`
    const count = segmentCounts.get(keyBase) ?? 0
    segmentCounts.set(keyBase, count + 1)
    return renderPiExtensionWidgetSegment(segment, `${count}:${keyBase}`, options)
  })
}

function renderPiExtensionWidgetSegment(
  segment: { className?: string | undefined; text: string },
  keyPrefix: string,
  options: { monoBoxGlyphs: boolean },
) {
  const parts = segment.text.split(piExtensionBoxGlyphPattern)
  const partCounts = new Map<string, number>()
  return parts.map((part) => {
    const count = partCounts.get(part) ?? 0
    partCounts.set(part, count + 1)
    const isBoxGlyph = piExtensionBoxGlyphPattern.test(part)
    piExtensionBoxGlyphPattern.lastIndex = 0
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

function getPiExtensionStyleClass(marker: string) {
  if (marker === 'reset') return undefined
  if (marker === 'bold:bold') return 'font-medium text-[color:var(--text)]'
  const [kind, name] = marker.split(':')
  if (kind === 'bg') return getPiExtensionBgClass(name)
  if (kind === 'fg') return getPiExtensionFgClass(name)
  return undefined
}

function getPiExtensionFgClass(name: string | undefined) {
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

function getPiExtensionBgClass(name: string | undefined) {
  switch (name) {
    case 'selectedBg':
    case 'customMessageBg':
      return 'bg-[color:var(--surface-hover)] text-[color:var(--text)]'
    default:
      return undefined
  }
}

function getPiExtensionShortcutKey(event: KeyboardEvent) {
  if (event.isComposing) return null
  const key = getPiExtensionShortcutBaseKey(event)
  if (!key) return null
  const modifiers = [
    event.ctrlKey ? 'ctrl' : null,
    event.altKey ? 'alt' : null,
    event.shiftKey ? 'shift' : null,
    event.metaKey ? 'meta' : null,
  ].filter(Boolean)
  return [...modifiers, key].join('+')
}

function isPlainPiExtensionShortcut(shortcut: string) {
  return !shortcut.includes('+')
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function isPiExtensionOverlayHovered(overlay: HTMLElement | null) {
  return Boolean(overlay?.matches(':hover'))
}

function getComposerTextarea(composerPanel: HTMLElement | null) {
  const textarea = composerPanel?.querySelector('textarea')
  return textarea instanceof HTMLTextAreaElement ? textarea : undefined
}

function applyPiExtensionEditorResult(input: {
  composerPanel: HTMLElement | null
  editorSelectionEnd?: number | undefined
  editorSelectionStart?: number | undefined
  editorText: string
  setDraft: (value: string) => void
}) {
  input.setDraft(input.editorText)
  const selectionStart = input.editorSelectionStart ?? input.editorText.length
  const selectionEnd = input.editorSelectionEnd ?? selectionStart
  window.requestAnimationFrame(() => {
    const textarea = getComposerTextarea(input.composerPanel)
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(selectionStart, selectionEnd)
  })
}

function getPiExtensionShortcutBaseKey(event: KeyboardEvent) {
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
  piExtensionDialogRequest,
  piExtensionShortcuts,
  piExtensionStatuses,
  piExtensionWidgets,
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
  const composerHoverToFocus = hoverToFocus && !takeoverVisible
  const composerHoverToBlur = hoverToBlur && !takeoverVisible
  const composerMode = activeView === 'chat' ? 'chat' : 'code'
  const sessionTreePanelRef = useRef<HTMLDivElement>(null)
  const composerPopoverStackRef = useRef<HTMLDivElement>(null)
  const sessionTreeCloseRef = useRef<(() => void) | null>(null)
  const sessionTreeCancelNavigateConfirmRef = useRef<(() => void) | null>(null)
  const sessionTreeCancelLabelPopoverRef = useRef<(() => void) | null>(null)
  const [sessionTreeNavigateConfirmOpen, setSessionTreeNavigateConfirmOpen] = useState(false)
  const [sessionTreeLabelPopoverOpen, setSessionTreeLabelPopoverOpen] = useState(false)
  const slashCommandPanelRef = useRef<HTMLDivElement>(null)
  const fileMentionPanelRef = useRef<HTMLDivElement>(null)
  const skillMentionPanelRef = useRef<HTMLDivElement>(null)
  const stopButtonBoundaryRef = useRef<HTMLDivElement>(null)
  const piExtensionOverlayRef = useRef<HTMLDivElement>(null)
  const showNativeDialog = piExtensionDialogRequest !== null
  const showProjectTrust = projectTrustRequest !== null
  const visiblePiExtensionWidgets = piExtensionWidgets.filter(
    (widget) => widget.placement === undefined || widget.placement === 'aboveEditor',
  )
  const showPiExtensionOverlay =
    showNativeDialog || showProjectTrust || visiblePiExtensionWidgets.length > 0
  const startNewSession = () => {
    void runComposerAction('thread.new', { projectId, chatGroupId, composerMode })
  }
  const openSessionTreeRef = useRef<() => void>(() => undefined)
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
    onOpenSessionTree: () => openSessionTreeRef.current(),
  })
  const { dismissSessionTree, openSessionTree, sessionTreeOpen } = useComposerSessionTreePanel({
    sessionPath,
    slashCommandsOpen: slashCommands.open,
  })
  openSessionTreeRef.current = openSessionTree
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
    sessionTreePanelRef,
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
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  const revealSessionTreeEntryInThread = useCallback(
    (entryId: string) => {
      if (!persistedSessionPath) return
      dispatchSessionTreeReveal({ sessionPath: persistedSessionPath, entryId })
    },
    [persistedSessionPath],
  )
  const {
    handleSessionTreeLabel,
    handleSessionTreeNavigate,
    sessionTreeForceHidden,
    sessionTreeNavigateDisabled,
  } = useComposerSessionTreeNavigate({
    activeView,
    chatGroupId,
    composerIsStreaming,
    extensionRunning,
    isCompacting,
    isSending,
    projectId,
    runComposerAction,
    sessionPath,
  })
  const handleSessionTreeNavigateAndClose = useCallback(
    async (entryId: string, summarize: boolean, label?: string) => {
      const ok = await handleSessionTreeNavigate(entryId, summarize, label)
      if (ok) closeSessionTree()
      return ok
    },
    [closeSessionTree, handleSessionTreeNavigate],
  )

  useComposerThreadOverlayHeight({
    extensionOverlayRef: piExtensionOverlayRef,
    extensionOverlayVisible: showPiExtensionOverlay,
    popoverStackRef: composerPopoverStackRef,
    popoverStackVisible: (sessionTreeOpen && !sessionTreeForceHidden) || slashCommands.open,
    onOverlayHeightChange,
  })

  const canStopComposer = (composerIsStreaming || extensionRunning) && !isSending && !!sessionPath
  const composerWorking = composerIsStreaming || extensionRunning
  const dismissComposerTransientUi = () => {
    setOpenMenu(null)
    slashCommands.dismiss()
    closeSessionTree()
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
    if (piExtensionShortcuts.length === 0) return
    const registeredShortcuts = new Set(
      piExtensionShortcuts.map((shortcut) => shortcut.shortcut.toLowerCase()),
    )
    const handlePiExtensionShortcut = (event: KeyboardEvent) => {
      const shortcut = getPiExtensionShortcutKey(event)
      if (!(shortcut && registeredShortcuts.has(shortcut))) return
      const overlayHovered = isPiExtensionOverlayHovered(piExtensionOverlayRef.current)
      const plainShortcut = isPlainPiExtensionShortcut(shortcut)
      if (plainShortcut && !overlayHovered) return
      if (plainShortcut && isEditableEventTarget(event.target)) return
      const textarea = getComposerTextarea(composerPanelRef.current)
      event.preventDefault()
      event.stopPropagation()
      void onAction('composer.pi-extension-shortcut', {
        projectId,
        sessionPath,
        composerMode,
        chatGroupId,
        editorSelectionEnd: textarea?.selectionEnd,
        editorSelectionStart: textarea?.selectionStart,
        editorText: textarea?.value ?? draft,
        shortcut,
      }).then((result) => {
        const editorText = result?.result?.editorText
        if (typeof editorText !== 'string') return
        applyPiExtensionEditorResult({
          composerPanel: composerPanelRef.current,
          editorSelectionEnd: result?.result?.editorSelectionEnd,
          editorSelectionStart: result?.result?.editorSelectionStart,
          editorText,
          setDraft,
        })
      })
    }
    window.addEventListener('keydown', handlePiExtensionShortcut, { capture: true })
    return () => window.removeEventListener('keydown', handlePiExtensionShortcut, { capture: true })
  }, [
    chatGroupId,
    composerMode,
    composerPanelRef,
    draft,
    onAction,
    piExtensionShortcuts,
    projectId,
    sessionPath,
    setDraft,
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
        {showPiExtensionOverlay ? (
          <div
            ref={piExtensionOverlayRef}
            className={cn(
              'pointer-events-auto absolute right-0 bottom-full left-0 grid gap-2',
              composerPopoverExtensionLayerClass,
            )}
          >
            <PiExtensionOverlayContent
              widgets={visiblePiExtensionWidgets}
              projectTrust={{
                request: projectTrustRequest,
                onDecide: async (trusted) => {
                  if (!projectTrustRequest) return false
                  return await runComposerAction('composer.set-project-trust', {
                    projectId,
                    sessionPath,
                    composerMode,
                    chatGroupId,
                    cwd: projectTrustRequest.cwd,
                    trusted,
                  })
                },
              }}
              nativeDialog={{
                request: piExtensionDialogRequest,
                onAnswer: async (answer) => {
                  if (!piExtensionDialogRequest) return false
                  return await runComposerAction('composer.answer-pi-extension-dialog', {
                    projectId,
                    sessionPath,
                    composerMode,
                    chatGroupId,
                    requestId: piExtensionDialogRequest.id,
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
              piTreeFilterMode={piTreeFilterMode}
              sessionPath={sessionPath}
              sessionTreeOpen={sessionTreeOpen}
              sessionTreePanelRef={sessionTreePanelRef}
              sessionTreeForceHidden={sessionTreeForceHidden}
              sessionTreeNavigateDisabled={sessionTreeNavigateDisabled}
              onSessionTreeNavigate={handleSessionTreeNavigateAndClose}
              onSessionTreeLabel={handleSessionTreeLabel}
              onRevealSessionTreeEntryInThread={revealSessionTreeEntryInThread}
              onBindSessionTreeClose={(close) => {
                sessionTreeCloseRef.current = close
              }}
              onSessionTreeNavigateConfirmOpenChange={setSessionTreeNavigateConfirmOpen}
              onSessionTreeLabelPopoverOpenChange={setSessionTreeLabelPopoverOpen}
              sessionTreeCancelNavigateConfirmRef={sessionTreeCancelNavigateConfirmRef}
              sessionTreeCancelLabelPopoverRef={sessionTreeCancelLabelPopoverRef}
              composerPopoverStackRef={composerPopoverStackRef}
              onSessionTreeTypingDismiss={closeSessionTree}
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
              hoverToFocus={composerHoverToFocus}
              hoverToBlur={composerHoverToBlur}
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
        <PiExtensionStatusLine statuses={piExtensionStatuses} />
      </div>

      <ComposerStopRail
        boundaryRef={stopButtonBoundaryRef}
        canStopComposer={canStopComposer}
        onStop={() => void stop()}
      />
    </div>
  )
}
