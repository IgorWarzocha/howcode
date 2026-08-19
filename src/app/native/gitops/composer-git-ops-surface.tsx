import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { type RefObject, useEffect } from 'react'
import { useHowcodeKeybindingCommand } from '../../app-shell/keybinding-events'
import { ComposerDictationControls } from '../../composer/composer-dictation-controls'
import { useComposerDictation } from '../../composer/useComposerDictation'
import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'
import { getFeatureStatusDataAttributes } from '../../features/feature-status'
import { composerTextActionButtonClass } from '../../ui/classes'
import { ComposerGitOpsFooter } from './composer-git-ops-footer'
import { ComposerGitOpsMessageField } from './composer-git-ops-message-field'
import { ComposerGitOpsTopBar } from './composer-git-ops-top-bar'
import type { GitOpsComposerDiff, GitOpsComposerProject } from './git-ops-composer-contracts'
import type { GitOpsReviewController } from './review/review-controller'
import { UntrackedScopePopover } from './untracked-scope-popover'
import { useComposerGitOpsState } from './useComposerGitOpsState'

type ComposerGitOpsSurfaceProps = {
  appSettings: AppSettings
  composerPanelRef: RefObject<HTMLDivElement | null>
  diff: GitOpsComposerDiff
  onAction: DesktopActionInvoker
  onActionErrorMessageChange?: (message: string | null) => void
  onBack: () => void
  onLayoutChange: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onReviewSent: () => void
  project: GitOpsComposerProject
  review: GitOpsReviewController
}

export function ComposerGitOpsSurface({
  appSettings,
  composerPanelRef,
  diff,
  onAction,
  onActionErrorMessageChange,
  onBack,
  onLayoutChange,
  onOpenSettingsView,
  onReviewSent,
  project,
  review,
}: ComposerGitOpsSurfaceProps) {
  const state = useComposerGitOpsState({
    appSettings,
    diffComments: review.comments,
    diffCommentsSending: review.sending,
    includeUntracked: diff.includeUntracked,
    onAction,
    onSendDiffComments: async (instruction) => {
      if (await review.send(instruction)) onReviewSent()
    },
    projectGitState: project.gitState,
  })
  const { message, options, primaryAction, repository, status } = state
  const hasDiffComments = state.review.hasComments
  const inputLocked = primaryAction.running || review.sending
  const hiddenUntrackedFileCount = diff.includeUntracked
    ? 0
    : (project.gitState?.untrackedFileCount ?? 0)

  const {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    toggleDictation,
  } = useComposerDictation({
    activeView: 'gitops',
    dictationModelId: appSettings.dictationModelId,
    dictationMaxDurationSeconds: appSettings.dictationMaxDurationSeconds,
    draftThreadId: `gitops:${project.id}`,
    projectId: project.id,
    sessionPath: project.sessionPath,
    setDraftValue: message.setValue,
    setErrorMessage: status.setErrorMessage,
  })
  const dictationTranscribing = dictationInterimText.length > 0

  useEffect(() => {
    onActionErrorMessageChange?.(status.errorMessage)
  }, [onActionErrorMessageChange, status.errorMessage])

  useHowcodeKeybindingCommand('dictation.toggle', (event) => {
    if (!(appSettings.showDictationButton && !inputLocked)) return
    event.preventDefault()
    void toggleDictation()
  })

  useEffect(() => {
    if (!(dictationActive || dictationTranscribing)) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      void cancelDictation()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [cancelDictation, dictationActive, dictationTranscribing])

  const trailingActions = (
    <div className="inline-flex items-center gap-2">
      {hiddenUntrackedFileCount > 0 ? (
        <UntrackedScopePopover
          count={hiddenUntrackedFileCount}
          onInclude={diff.toggleIncludeUntracked}
        />
      ) : null}
      <button
        type="button"
        className={`${composerTextActionButtonClass} border-0 bg-[color:var(--surface-hover)] hover:bg-[color:var(--surface-hover)]`}
        onClick={() => void primaryAction.run()}
        disabled={
          hasDiffComments
            ? review.sending
            : primaryAction.running || (repository.isGitRepo ? !primaryAction.canCommit : false)
        }
        aria-label={primaryAction.label}
        data-tooltip={primaryAction.label}
      >
        {primaryAction.label}
      </button>
    </div>
  )

  const messageField = (
    <ComposerGitOpsMessageField
      actionErrorMessage={null}
      actionStatusMessage={status.statusMessage}
      commitFocused={message.focused}
      diffCommentError={review.error ?? diff.loadError}
      hasDiffComments={hasDiffComments}
      isGitRepo={repository.isGitRepo}
      hoverToFocus={appSettings.hoverToFocus}
      hoverToBlur={appSettings.hoverToBlur}
      hoverBoundaryRef={composerPanelRef}
      onBlur={() => message.setFocused(false)}
      onChange={message.onChange}
      onFocus={() => message.setFocused(true)}
      onInput={() => {
        if (status.errorMessage) status.setErrorMessage(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && (dictationActive || dictationTranscribing)) {
          event.preventDefault()
          void cancelDictation()
        }
      }}
      onLayoutChange={onLayoutChange}
      leadingAdornment={
        <ComposerDictationControls
          dictationActive={dictationActive}
          dictationMissingModel={dictationMissingModel}
          dictationSupported={dictationSupported}
          dictationTranscribing={dictationTranscribing}
          onAction={onAction}
          onOpenSettingsView={onOpenSettingsView}
          showDictationButton={appSettings.showDictationButton && !inputLocked}
          toggleDictation={toggleDictation}
        />
      }
      trailingAccessory={trailingActions}
      value={message.value}
    />
  )

  return (
    <div className="grid gap-0" {...getFeatureStatusDataAttributes('feature:composer.git-ops')}>
      <div className="relative">
        {hasDiffComments ? (
          <ComposerGitOpsTopBar
            commentCards={state.review.commentCards}
            onSelectDiffComment={review.select}
          />
        ) : (
          messageField
        )}
      </div>
      {hasDiffComments ? messageField : null}
      <ComposerGitOpsFooter
        composerPanelRef={composerPanelRef}
        diff={diff}
        onBack={onBack}
        options={options}
        project={project}
        repository={repository}
        review={review}
      />
    </div>
  )
}
