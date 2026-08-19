import { ComposerFilePicker } from '../../composer/composer-file-picker'
import { ComposerPromptInputPanel } from '../../composer/composer-prompt-input-panel'
import { ComposerPromptPopoverStack } from '../../composer/composer-prompt-popover-stack'
import { composerPanelClass } from '../../ui/classes'
import { InboxComposerFooter } from './inbox-composer-footer'
import { InboxAttachmentRail, InboxStopRail } from './inbox-composer-rails'
import type { InboxComposerProps } from './inbox-composer-types'
import type { InboxComposerActions } from './useInboxComposerActions'
import type { InboxComposerAutocomplete } from './useInboxComposerAutocomplete'
import type { InboxComposerInput } from './useInboxComposerInput'
import type { InboxComposerOverlayState } from './useInboxComposerOverlayState'

export function InboxComposerSurface({
  actions,
  autocomplete,
  input,
  overlay,
  props,
}: {
  actions: InboxComposerActions
  autocomplete: InboxComposerAutocomplete
  input: InboxComposerInput
  overlay: InboxComposerOverlayState
  props: InboxComposerProps
}) {
  return (
    <div
      ref={overlay.composerSurfaceRef}
      className="relative grid w-full grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-2 overflow-visible"
      data-composer-root="true"
    >
      <InboxAttachmentRail
        attachmentCount={props.reply.attachments.length}
        pickerButtonRef={overlay.pickerButtonRef}
        onClearAttachments={input.clearAttachments}
        onPickAttachments={() => {
          if (autocomplete.slashCommands.open) {
            autocomplete.slashCommands.dismiss({ clearDraft: true })
          }
          void input.pickAttachments()
        }}
      />

      <div className="relative grid gap-0 overflow-visible">
        <section className={composerPanelClass} aria-label="Inbox composer panel">
          {overlay.openMenu === 'picker' ? (
            <ComposerFilePicker
              anchorRef={overlay.pickerButtonRef}
              attachments={props.reply.attachments}
              errorMessage={props.reply.errorMessage}
              favoriteFolders={props.appSettings.favoriteFolders}
              loading={input.pickerLoading}
              picker={input.pickerState}
              panelRef={overlay.pickerPanelRef}
              projectRootPath={props.thread.projectId}
              onAttachAttachments={input.attachPickerAttachments}
              onOpenRoot={input.openPickerRoot}
              onOpenDirectory={input.openPickerDirectory}
              onRemoveAttachment={input.removeAttachment}
              onToggleFile={input.togglePendingPickerAttachment}
            />
          ) : null}
          <ComposerPromptInputPanel
            clearError={() => props.reply.setErrorMessage(null)}
            dictationActive={input.dictationActive}
            dictationMissingModel={input.dictationMissingModel}
            dictationSupported={input.dictationSupported}
            dictationTranscribing={input.dictationInterimText.length > 0 && !input.dictationActive}
            draft={props.reply.draft}
            errorMessage={props.reply.errorMessage}
            extensionRunning={false}
            inputLocked={actions.inputLocked}
            placeholderText={props.reply.errorMessage ?? 'Reply to this thread…'}
            promptPopover={
              <ComposerPromptPopoverStack
                sessionTreePanelRef={overlay.sessionTreePanelRef}
                slashCommandPanelRef={overlay.slashCommandPanelRef}
                slashCommands={autocomplete.slashCommands}
              />
            }
            slashCommands={autocomplete.slashCommands}
            fileMentionPanelRef={overlay.fileMentionPanelRef}
            fileMentions={autocomplete.fileMentions}
            skillMentionPanelRef={overlay.skillMentionPanelRef}
            skillMentions={autocomplete.skillMentions}
            showDictationButton={props.appSettings.showDictationButton}
            cancelDictation={input.cancelDictation}
            handlePaste={input.handlePaste}
            hoverToFocus={props.appSettings.hoverToFocus}
            hoverToBlur={props.appSettings.hoverToBlur}
            composerSendMode={props.appSettings.composerSendMode}
            keybindings={props.appSettings.keybindings}
            hoverBoundaryRef={overlay.composerSurfaceRef}
            onAction={props.onAction}
            onOpenSettingsView={props.onOpenSettingsView}
            setDraft={input.setDraftValue}
            toggleDictation={input.toggleDictation}
          />

          {props.reply.errorMessage ? (
            <output className="sr-only" aria-live="polite">
              {props.reply.errorMessage}
            </output>
          ) : null}

          <InboxComposerFooter
            availableModels={props.modelState.availableModels}
            availableThinkingLevels={props.modelState.availableThinkingLevels}
            contextUsage={props.modelState.contextUsage}
            currentModel={props.modelState.currentModel}
            currentThinkingLevel={props.modelState.currentThinkingLevel}
            isCompacting={props.isCompacting}
            isStreaming={props.thread.running}
            localActionPending={actions.localActionPending}
            modelButtonRef={overlay.modelButtonRef}
            modelMenuOpen={overlay.openMenu === 'model'}
            modelMenuRef={overlay.modelMenuRef}
            sessionPath={props.thread.sessionPath}
            onCompact={() => void actions.compact()}
            onDismiss={props.onDismiss}
            onOpenThread={props.onOpenThread}
            onSelectModel={(model) => void actions.selectModel(model)}
            onSelectThinkingLevel={(level) => void actions.selectThinkingLevel(level)}
            onToggleModelMenu={() =>
              overlay.setOpenMenu((current) => (current === 'model' ? null : 'model'))
            }
          />
        </section>
      </div>
      <InboxStopRail
        isStreaming={props.thread.running}
        isSending={props.reply.isSending}
        localActionPending={actions.localActionPending}
        onStop={props.reply.stop}
      />
    </div>
  )
}
