import { ArrowUpRight, Bot, Paperclip, Square, X } from 'lucide-react'
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react'
import { getDesktopActionErrorMessage } from '../../../desktop/action-results'
import { getErrorMessage } from '../../../desktop/error-messages'
import type {
  AppSettings,
  ComposerAttachment,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxThread,
} from '../../../desktop/types'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { IconButton } from '../../common/icon-button'
import { ToolbarButton } from '../../common/toolbar-button'
import { Tooltip } from '../../common/tooltip'
import { ComposerContextMeter } from '../composer/composer-context-meter'
import { ComposerModelPopover } from '../composer/composer-model-popover'
import { ComposerPromptInputPanel } from '../composer/composer-prompt-input-panel'
import { useComposerAttachmentPicker } from '../composer/useComposerAttachmentPicker'
import { useComposerClipboardHandlers } from '../composer/useComposerClipboardHandlers'
import { useComposerDictation } from '../composer/useComposerDictation'
import { useComposerFileMentions } from '../composer/useComposerFileMentions'
import { useComposerSkillMentions } from '../composer/useComposerSkillMentions'
import { useComposerSlashCommands } from '../composer/useComposerSlashCommands'
import {
  workspaceFooterRowClass,
  workspaceFooterTextClass,
  workspaceFooterTrailingGroupClass,
} from '../footer/workspace-footer-primitives'

const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
}

function isTargetWithinRefs(target: Node, refs: RefObject<Node | null>[]) {
  return refs.some((ref) => ref.current?.contains(target))
}

type InboxComposerProps = {
  appSettings: AppSettings
  attachments: ComposerAttachment[]
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  contextUsage: ComposerContextUsage | null
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
  draft: string
  errorMessage: string | null
  favoriteFolders: string[]
  isCompacting: boolean
  isStreaming: boolean
  isSending: boolean
  showDictationButton: boolean
  thread: InboxThread
  onAction: DesktopActionInvoker
  onChangeAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  onChangeDraft: Dispatch<SetStateAction<string>>
  onChangeErrorMessage: Dispatch<SetStateAction<string | null>>
  onDismiss: () => void
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onOpenThread: () => void
  onOpenSettingsView: () => void
  onSend: (input: { draft: string; attachments: ComposerAttachment[] }) => Promise<void> | void
  onStop: () => void
}

export function InboxComposer({
  appSettings,
  attachments,
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  draft,
  errorMessage,
  favoriteFolders,
  isCompacting,
  isStreaming,
  isSending,
  showDictationButton,
  thread,
  onAction,
  onChangeAttachments,
  onChangeDraft,
  onChangeErrorMessage,
  onDismiss,
  onListAttachmentEntries,
  onOpenThread,
  onOpenSettingsView,
  onSend,
  onStop,
}: InboxComposerProps) {
  const [openMenu, setOpenMenu] = useState<'model' | 'picker' | null>(null)
  const composerSurfaceRef = useRef<HTMLDivElement>(null)
  const composerPanelRef = useRef<HTMLDivElement>(null)
  const pickerButtonRef = useRef<HTMLButtonElement>(null)
  const pickerPanelRef = useRef<HTMLDivElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const slashCommandPanelRef = useRef<HTMLDivElement>(null)
  const fileMentionPanelRef = useRef<HTMLDivElement>(null)
  const skillMentionPanelRef = useRef<HTMLDivElement>(null)
  const draftValueRef = useRef(draft)
  const attachmentsRef = useRef(attachments)
  const sendLockRef = useRef(false)
  const [localActionPending, setLocalActionPending] = useState(false)
  useEffect(() => {
    draftValueRef.current = draft
  }, [draft])

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  const setDraftValue: Dispatch<SetStateAction<string>> = (value) => {
    const nextValue =
      typeof value === 'function'
        ? (value as (current: string) => string)(draftValueRef.current)
        : value
    draftValueRef.current = nextValue
    onChangeDraft(nextValue)
  }

  const setAttachmentValue: Dispatch<SetStateAction<ComposerAttachment[]>> = (value) => {
    const nextValue =
      typeof value === 'function'
        ? (value as (current: ComposerAttachment[]) => ComposerAttachment[])(attachmentsRef.current)
        : value
    attachmentsRef.current = nextValue
    onChangeAttachments(nextValue)
  }

  useDismissibleLayer({
    open: openMenu === 'model',
    onDismiss: () => setOpenMenu(null),
    refs: [modelButtonRef, modelMenuRef],
  })

  useEffect(() => {
    if (openMenu !== 'picker') {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (!target) {
        return
      }

      if (pickerButtonRef.current?.contains(target) || pickerPanelRef.current?.contains(target)) {
        return
      }

      if (composerSurfaceRef.current?.contains(target)) {
        return
      }

      setOpenMenu((current) => (current === 'picker' ? null : current))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      setOpenMenu((current) => (current === 'picker' ? null : current))
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [openMenu])

  const {
    attachPickerAttachments,
    clearAttachments,
    openPickerDirectory,
    openPickerRoot,
    pickAttachments,
    pickerLoading,
    pickerState,
    removeAttachment,
    togglePendingPickerAttachment,
  } = useComposerAttachmentPicker({
    openMenu,
    pickerRootPath: thread.projectId,
    pickerSessionKey: thread.sessionPath,
    setAttachments: setAttachmentValue,
    setErrorMessage: onChangeErrorMessage,
    setOpenMenu,
    onListAttachmentEntries,
  })

  const {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    stopDictationAndFlush,
    toggleDictation,
  } = useComposerDictation({
    activeView: 'inbox',
    dictationModelId: appSettings.dictationModelId,
    dictationMaxDurationSeconds: appSettings.dictationMaxDurationSeconds,
    draftThreadId: thread.threadId,
    projectId: thread.projectId,
    sessionPath: thread.sessionPath,
    setDraftValue,
    setErrorMessage: onChangeErrorMessage,
  })

  const send = async () => {
    if (sendLockRef.current || isSending || isCompacting || localActionPending) {
      return
    }

    sendLockRef.current = true
    setLocalActionPending(true)
    try {
      await stopDictationAndFlush()
      await onSend({ draft: draftValueRef.current, attachments: attachmentsRef.current })
    } finally {
      sendLockRef.current = false
      setLocalActionPending(false)
    }
  }

  const slashCommands = useComposerSlashCommands({
    draft,
    projectId: thread.projectId,
    sessionPath: thread.sessionPath,
    setDraft: setDraftValue,
    send: () => void send(),
    onOpenSettingsView,
  })

  const slashCommandListSignature = slashCommands.commands
    .map((command) => `${command.source}:${command.name}`)
    .join('|')
  const skillMentions = useComposerSkillMentions({
    draft,
    projectId: thread.projectId,
    sessionPath: thread.sessionPath,
    setDraft: setDraftValue,
  })
  const skillMentionListSignature = skillMentions.skills
    .map((skill) => `${skill.name}:${skill.filePath}`)
    .join('|')
  const fileMentions = useComposerFileMentions({
    draft,
    projectId: thread.projectId,
    setDraft: setDraftValue,
    attachAttachments: attachPickerAttachments,
  })
  const fileMentionListSignature = fileMentions.files
    .map((file) => `${file.kind}:${file.path}`)
    .join('|')
  const { handlePaste } = useComposerClipboardHandlers({
    setAttachments: setAttachmentValue,
    setDraftValue,
    setErrorMessage: onChangeErrorMessage,
  })

  useEffect(() => {
    if (slashCommands.open || fileMentions.open || skillMentions.open) {
      setOpenMenu((current) => (current === 'picker' ? null : current))
    }
  }, [fileMentions.open, skillMentions.open, slashCommands.open])

  useEffect(() => {
    if (!(slashCommands.open || fileMentions.open || skillMentions.open)) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (!target) {
        return
      }

      if (
        isTargetWithinRefs(target, [
          slashCommandPanelRef,
          fileMentionPanelRef,
          skillMentionPanelRef,
          composerSurfaceRef,
        ])
      ) {
        return
      }

      if (slashCommands.open) slashCommands.dismiss({ clearDraft: true })
      if (fileMentions.open) fileMentions.dismiss()
      if (skillMentions.open) skillMentions.dismiss()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      if (slashCommands.open) slashCommands.dismiss()
      if (fileMentions.open) fileMentions.dismiss()
      if (skillMentions.open) skillMentions.dismiss()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [fileMentions, skillMentions, slashCommands])

  useEffect(() => {
    if (!(slashCommands.open && slashCommands.activeDescendantId)) {
      return
    }

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

  const compact = async () => {
    if (sendLockRef.current || isSending || isStreaming || isCompacting || !thread.sessionPath) {
      return
    }

    sendLockRef.current = true
    setLocalActionPending(true)
    onChangeErrorMessage(null)
    try {
      await stopDictationAndFlush()
      const result = await onAction('composer.send', {
        projectId: thread.projectId,
        sessionPath: thread.sessionPath,
        text: '/compact',
        attachments: [],
        streamingBehavior: appSettings.composerStreamingBehavior,
        composerMode: thread.isChat ? 'chat' : 'code',
      })

      const actionErrorMessage = getDesktopActionErrorMessage(result, 'Could not compact context.')
      if (actionErrorMessage) {
        onChangeErrorMessage(actionErrorMessage)
      }
    } catch (error) {
      onChangeErrorMessage(getErrorMessage(error, 'Could not compact context.'))
    } finally {
      sendLockRef.current = false
      setLocalActionPending(false)
    }
  }

  const updateComposerOption = async (
    action: 'composer.model' | 'composer.thinking',
    payload: NonNullable<Parameters<DesktopActionInvoker>[1]>,
  ) => {
    onChangeErrorMessage(null)

    try {
      const result = await onAction(action, payload)
      const actionErrorMessage = getDesktopActionErrorMessage(
        result,
        'Could not update the composer.',
      )
      if (actionErrorMessage) {
        onChangeErrorMessage(actionErrorMessage)
        return
      }

      setOpenMenu(null)
    } catch (error) {
      onChangeErrorMessage(getErrorMessage(error, 'Could not update the composer.'))
    }
  }

  return (
    <div
      ref={composerSurfaceRef}
      className="relative grid w-full grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-2 overflow-visible"
    >
      <div className="relative h-full min-h-[7rem] w-8 shrink-0 self-stretch text-[color:var(--muted)]">
        <div className="absolute bottom-[3.55rem] left-0 flex w-7 flex-col-reverse items-center gap-1">
          {attachments.length > 0 ? (
            <>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--accent-bg-subtle)] px-1.5 py-0.5 text-[11px] text-[color:var(--text)]">
                {attachments.length}
              </span>
              <button
                type="button"
                className={cn(compactIconButtonClass, 'h-5 w-5 shrink-0 rounded-full')}
                onClick={clearAttachments}
                aria-label="Clear attachments"
                data-tooltip="Clear attachments"
              >
                <X size={12} />
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
              void pickAttachments()
            }}
            aria-label={attachments.length > 0 ? 'Manage attachments' : 'Add attachment'}
            data-tooltip={attachments.length > 0 ? 'Manage attachments' : 'Add attachment'}
          >
            <span className={cn(compactIconButtonClass, 'h-7 w-7 shrink-0 rounded-full')}>
              <Paperclip size={15} />
            </span>
          </button>
        </div>
      </div>

      <div className="relative grid gap-0 overflow-visible">
        <section
          ref={composerPanelRef}
          className="grid gap-0 overflow-visible rounded-[20px] border border-[color:var(--accent-border)] bg-[color:var(--panel)] shadow-none"
          aria-label="Inbox composer panel"
        >
          <ComposerPromptInputPanel
            attachments={attachments}
            clearError={() => onChangeErrorMessage(null)}
            dictationActive={dictationActive}
            dictationMissingModel={dictationMissingModel}
            dictationSupported={dictationSupported}
            dictationTranscribing={dictationInterimText.length > 0 && !dictationActive}
            draft={draft}
            errorMessage={errorMessage}
            extensionRunning={false}
            inputLocked={isSending || localActionPending}
            favoriteFolders={favoriteFolders}
            pickerLoading={pickerLoading}
            pickerOpen={openMenu === 'picker'}
            pickerButtonRef={pickerButtonRef}
            pickerPanelRef={pickerPanelRef}
            pickerState={pickerState}
            placeholderText={errorMessage ?? 'Reply to this thread…'}
            projectId={thread.projectId}
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
            hoverToFocus={appSettings.hoverToFocus}
            hoverToBlur={appSettings.hoverToBlur}
            hoverBoundaryRef={composerSurfaceRef}
            onAction={onAction}
            onOpenSettingsView={onOpenSettingsView}
            openPickerDirectory={openPickerDirectory}
            openPickerRoot={openPickerRoot}
            removeAttachment={removeAttachment}
            setDraft={setDraftValue}
            toggleDictation={toggleDictation}
            togglePendingPickerAttachment={togglePendingPickerAttachment}
          />

          {errorMessage ? (
            <output className="sr-only" aria-live="polite">
              {errorMessage}
            </output>
          ) : null}

          <div className="h-px bg-[color:var(--border)]" />

          <div className={workspaceFooterRowClass}>
            <div className="relative inline-flex h-7 items-center">
              <ToolbarButton
                ref={modelButtonRef}
                label="Agent"
                tooltip="Model settings"
                icon={<Bot size={14} />}
                className={cn(workspaceFooterTextClass, 'pr-8')}
                onClick={() => setOpenMenu((current) => (current === 'model' ? null : 'model'))}
                aria-haspopup="menu"
                aria-expanded={openMenu === 'model'}
                aria-controls="composer-model-menu"
              />
              <div className="absolute top-0 right-0">
                <ComposerContextMeter
                  contextUsage={contextUsage}
                  compactDisabled={
                    isStreaming || isCompacting || localActionPending || !thread.sessionPath
                  }
                  isCompacting={isCompacting}
                  onCompact={() => void compact()}
                />
              </div>
              {openMenu === 'model' ? (
                <ComposerModelPopover
                  anchorRef={modelButtonRef}
                  availableModels={availableModels}
                  availableThinkingLevels={availableThinkingLevels}
                  currentModel={currentModel}
                  currentThinkingLevel={currentThinkingLevel}
                  panelRef={modelMenuRef}
                  thinkingLevelLabels={thinkingLevelLabels}
                  onSelectModel={(availableModel) => {
                    void updateComposerOption('composer.model', {
                      provider: availableModel.provider,
                      modelId: availableModel.id,
                      projectId: thread.projectId,
                      sessionPath: thread.sessionPath,
                    })
                  }}
                  onSelectThinkingLevel={(level) => {
                    void updateComposerOption('composer.thinking', {
                      level,
                      projectId: thread.projectId,
                      sessionPath: thread.sessionPath,
                    })
                  }}
                />
              ) : null}
            </div>
            <div className={workspaceFooterTrailingGroupClass}>
              <Tooltip content="Dismiss">
                <IconButton
                  tooltip={null}
                  label="Dismiss"
                  icon={<X size={14} />}
                  onClick={onDismiss}
                />
              </Tooltip>
              <Tooltip content="Open thread">
                <IconButton
                  tooltip={null}
                  label="Open thread"
                  icon={<ArrowUpRight size={14} />}
                  onClick={onOpenThread}
                />
              </Tooltip>
            </div>
          </div>
        </section>
      </div>
      <div className="relative h-full min-h-[7rem] w-8 shrink-0 self-stretch text-[color:var(--muted)]">
        <div className="absolute right-0 bottom-[3.55rem] flex w-7 items-center justify-center">
          <button
            type="button"
            className={cn(
              compactIconButtonClass,
              'h-7 w-7 shrink-0 rounded-full text-[color:var(--danger)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]',
              isStreaming && !isSending && !localActionPending
                ? 'bg-[color:var(--danger-bg)] opacity-80'
                : 'bg-transparent opacity-25 hover:opacity-45',
            )}
            onClick={onStop}
            disabled={!isStreaming || isSending || localActionPending}
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
