import { type Dispatch, type SetStateAction, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
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
import { composerPanelClass } from '../../../ui/classes'
import type { SettingsOpenTarget } from '../../../views/settings/settingsTypes'
import { ComposerPromptInputPanel } from '../composer/composer-prompt-input-panel'
import { useComposerAttachmentPicker } from '../composer/useComposerAttachmentPicker'
import { useComposerClipboardHandlers } from '../composer/useComposerClipboardHandlers'
import { useComposerDictation } from '../composer/useComposerDictation'
import { useComposerFileMentions } from '../composer/useComposerFileMentions'
import { useComposerSkillMentions } from '../composer/useComposerSkillMentions'
import { useComposerSlashCommands } from '../composer/useComposerSlashCommands'
import { InboxComposerFooter } from './inbox-composer-footer'
import { InboxAttachmentRail, InboxStopRail } from './inbox-composer-rails'
import {
  useInboxMentionActiveOptionScroll,
  useInboxSlashCommandActiveOptionScroll,
} from './useInboxComposerActiveOptionScroll'
import { useInboxComposerMentionDismiss } from './useInboxComposerMentionDismiss'
import { useInboxComposerPickerDismiss } from './useInboxComposerPickerDismiss'
import { useInboxComposerStateRefs } from './useInboxComposerStateRefs'

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
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onStartNewSession: () => void
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
  onStartNewSession,
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
  const sendLockRef = useRef(false)
  const [localActionPending, setLocalActionPending] = useState(false)
  const { attachmentsRef, draftValueRef, setAttachmentValue, setDraftValue } =
    useInboxComposerStateRefs({
      attachments,
      draft,
      onChangeAttachments,
      onChangeDraft,
    })

  useDismissibleLayer({
    open: openMenu === 'model',
    onDismiss: () => setOpenMenu(null),
    refs: [modelButtonRef, modelMenuRef],
  })

  useInboxComposerPickerDismiss({
    composerSurfaceRef,
    openMenu,
    pickerButtonRef,
    pickerPanelRef,
    setOpenMenu,
  })

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

  useHowcodeKeybindingCommand('dictation.toggle', (event) => {
    if (!showDictationButton) return
    event.preventDefault()
    void toggleDictation()
  })

  const slashCommands = useComposerSlashCommands({
    draft,
    projectId: thread.projectId,
    sessionPath: thread.sessionPath,
    setDraft: setDraftValue,
    send: () => void send(),
    onOpenSettingsView,
    onStartNewSession,
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

  useInboxComposerMentionDismiss({
    composerSurfaceRef,
    fileMentionPanelRef,
    fileMentions,
    setOpenMenu,
    skillMentionPanelRef,
    skillMentions,
    slashCommandPanelRef,
    slashCommands,
  })

  useInboxSlashCommandActiveOptionScroll({
    listSignature: slashCommandListSignature,
    panelRef: slashCommandPanelRef,
    state: slashCommands,
  })
  useInboxMentionActiveOptionScroll({
    listSignature: fileMentionListSignature,
    panelRef: fileMentionPanelRef,
    state: fileMentions,
  })
  useInboxMentionActiveOptionScroll({
    listSignature: skillMentionListSignature,
    panelRef: skillMentionPanelRef,
    state: skillMentions,
  })

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
      data-composer-root="true"
    >
      <InboxAttachmentRail
        attachmentCount={attachments.length}
        pickerButtonRef={pickerButtonRef}
        onClearAttachments={clearAttachments}
        onPickAttachments={() => {
          if (slashCommands.open) {
            slashCommands.dismiss({ clearDraft: true })
          }
          void pickAttachments()
        }}
      />

      <div className="relative grid gap-0 overflow-visible">
        <section
          ref={composerPanelRef}
          className={composerPanelClass}
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
            composerSendMode={appSettings.composerSendMode}
            keybindings={appSettings.keybindings}
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

          <InboxComposerFooter
            availableModels={availableModels}
            availableThinkingLevels={availableThinkingLevels}
            contextUsage={contextUsage}
            currentModel={currentModel}
            currentThinkingLevel={currentThinkingLevel}
            isCompacting={isCompacting}
            isStreaming={isStreaming}
            localActionPending={localActionPending}
            modelButtonRef={modelButtonRef}
            modelMenuOpen={openMenu === 'model'}
            modelMenuRef={modelMenuRef}
            sessionPath={thread.sessionPath}
            onCompact={() => void compact()}
            onDismiss={onDismiss}
            onOpenThread={onOpenThread}
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
            onToggleModelMenu={() =>
              setOpenMenu((current) => (current === 'model' ? null : 'model'))
            }
          />
        </section>
      </div>
      <InboxStopRail
        isStreaming={isStreaming}
        isSending={isSending}
        localActionPending={localActionPending}
        onStop={onStop}
      />
    </div>
  )
}
