import { type RefObject, useEffect } from 'react'
import { DraftInputContribution } from '../../../../src/app/composer/draft-input-contribution'
import type { AppSettings, DesktopActionInvoker } from '../../../../src/app/desktop/types'
import { getFeatureStatusDataAttributes } from '../../../../src/app/features/feature-status'
import type { SettingsOpenTarget } from '../../../../src/app/settings/settings/settingsTypes'
import { composerTextActionButtonClass } from '../../../../src/app/ui/classes'
import { ComposerGitOpsFooter } from './composer-git-ops-footer'
import { ComposerGitOpsMessageField } from './composer-git-ops-message-field'
import { ComposerGitOpsTopBar } from './composer-git-ops-top-bar'
import type { GitOpsComposerDiff, GitOpsComposerDirectory } from './git-ops-composer-contracts'
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
  directory: GitOpsComposerDirectory
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
  directory,
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
    directoryGitState: directory.gitState,
  })
  const { message, options, primaryAction, repository, status } = state
  const hasDiffComments = state.review.hasComments
  const inputLocked = primaryAction.running || review.sending
  const hiddenUntrackedFileCount = diff.includeUntracked
    ? 0
    : (directory.gitState?.untrackedFileCount ?? 0)

  useEffect(() => {
    onActionErrorMessageChange?.(status.errorMessage)
  }, [onActionErrorMessageChange, status.errorMessage])

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

  return (
    <DraftInputContribution
      appSettings={appSettings}
      directoryId={directory.id}
      conversationId={directory.conversationId}
      draftChatId={`gitops:${directory.id}`}
      activeView="chat"
      composerPanelRef={composerPanelRef}
      inputLocked={inputLocked}
      setDraftValue={message.setValue}
      setErrorMessage={status.setErrorMessage}
      onAction={onAction}
      onOpenSettingsView={onOpenSettingsView}
    >
      {(voice) => {
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
            onKeyDown={voice.onKeyDown}
            onLayoutChange={onLayoutChange}
            leadingAdornment={voice.leadingAdornment}
            trailingAccessory={trailingActions}
            value={message.value}
          />
        )
        return (
          <div
            className="grid gap-0"
            {...getFeatureStatusDataAttributes('feature:composer.git-ops')}
          >
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
              directory={directory}
              repository={repository}
              review={review}
            />
          </div>
        )
      }}
    </DraftInputContribution>
  )
}
