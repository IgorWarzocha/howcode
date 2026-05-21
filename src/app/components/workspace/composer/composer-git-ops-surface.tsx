import { type RefObject, useEffect } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type {
  AppSettings,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
} from '../../../desktop/types'
import { getFeatureStatusDataAttributes } from '../../../features/feature-status'
import { composerTextActionButtonClass } from '../../../ui/classes'
import type { SettingsOpenTarget } from '../../../views/settings/settingsTypes'
import type { SavedDiffComment } from '../diff/diffCommentStore'
import { ComposerDictationControls } from './composer-dictation-controls'
import { ComposerGitOpsFooter } from './composer-git-ops-footer'
import { ComposerGitOpsMessageField } from './composer-git-ops-message-field'
import { ComposerGitOpsTopBar } from './composer-git-ops-top-bar'
import { useComposerDictation } from './useComposerDictation'
import { useComposerGitOpsState } from './useComposerGitOpsState'

type ComposerGitOpsSurfaceProps = {
  dictationModelId: string | null
  dictationMaxDurationSeconds: number
  composerPanelRef: RefObject<HTMLDivElement | null>
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  projectGitState: ProjectGitState | null
  projectId: string
  sessionPath: string | null
  showDictationButton: boolean
  appSettings: AppSettings
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  diffComments: SavedDiffComment[]
  diffCommentCount: number
  diffCommentsSending: boolean
  diffCommentError: string | null
  diffLoadError: string | null
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (mode: ProjectDiffRenderMode) => void
  onSendDiffComments: (message?: string | null) => void
  onSelectDiffComment: (filePath: string, commentId: string) => void
  onAction: DesktopActionInvoker
  onLayoutChange: () => void
  onBack: () => void
  onActionErrorMessageChange?: (message: string | null) => void
}

export function ComposerGitOpsSurface({
  dictationModelId,
  dictationMaxDurationSeconds,
  composerPanelRef,
  onOpenSettingsView,
  projectGitState,
  projectId,
  sessionPath,
  showDictationButton,
  appSettings,
  diffBaseline,
  diffRenderMode,
  diffComments,
  diffCommentCount,
  diffCommentsSending,
  diffCommentError,
  diffLoadError,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  onSendDiffComments,
  onSelectDiffComment,
  onAction,
  onLayoutChange,
  onBack,
  onActionErrorMessageChange,
}: ComposerGitOpsSurfaceProps) {
  void diffCommentCount

  const {
    actionErrorMessage,
    actionStatusMessage,
    canCommit,
    commentCards,
    commitFocused,
    commitMessage,
    handleCommitMessageChange,
    handlePrimaryAction,
    handleSaveOrigin,
    hasDiffComments,
    hasOrigin,
    includeUnstaged,
    isGitRepo,
    previewEnabled,
    primaryActionLabel,
    pushEnabled,
    repoUrl,
    runningPrimaryAction,
    setCommitFocused,
    setActionErrorMessage,
    setCommitMessageValue,
    setIncludeUnstaged,
    setPushEnabled,
    setRepoUrl,
    saveProjectGitOpsMode,
    togglePreviewEnabled,
  } = useComposerGitOpsState({
    appSettings,
    diffComments,
    diffCommentsSending,
    onAction,
    onSendDiffComments,
    projectGitState,
  })

  const {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    toggleDictation,
  } = useComposerDictation({
    activeView: 'gitops',
    dictationModelId,
    dictationMaxDurationSeconds,
    draftThreadId: `gitops:${projectId}`,
    projectId,
    sessionPath,
    setDraftValue: setCommitMessageValue,
    setErrorMessage: setActionErrorMessage,
  })
  const dictationTranscribing = dictationInterimText.length > 0

  useEffect(() => {
    onActionErrorMessageChange?.(actionErrorMessage)
  }, [actionErrorMessage, onActionErrorMessageChange])

  useHowcodeKeybindingCommand('dictation.toggle', (event) => {
    if (!showDictationButton) return
    event.preventDefault()
    void toggleDictation()
  })

  useEffect(() => {
    if (!(dictationActive || dictationTranscribing)) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
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
  }, [cancelDictation, dictationActive, dictationTranscribing])

  const dictationControls = (
    <ComposerDictationControls
      dictationActive={dictationActive}
      dictationMissingModel={dictationMissingModel}
      dictationSupported={dictationSupported}
      dictationTranscribing={dictationTranscribing}
      onAction={onAction}
      onOpenSettingsView={onOpenSettingsView}
      showDictationButton={showDictationButton}
      toggleDictation={toggleDictation}
    />
  )
  const primaryActionButton = (
    <button
      type="button"
      className={`${composerTextActionButtonClass} border-0 bg-[color:var(--surface-hover)] hover:bg-[color:var(--surface-hover)]`}
      onClick={() => {
        void handlePrimaryAction()
      }}
      disabled={
        hasDiffComments
          ? diffCommentsSending
          : runningPrimaryAction || (isGitRepo ? !canCommit : false)
      }
      aria-label={primaryActionLabel}
      data-tooltip={primaryActionLabel}
    >
      {primaryActionLabel}
    </button>
  )
  const trailingActions = (
    <div className="inline-flex items-center gap-2">
      {dictationControls}
      {primaryActionButton}
    </div>
  )

  return (
    <div className="grid gap-0" {...getFeatureStatusDataAttributes('feature:composer.git-ops')}>
      {/* Keep one-line default height here too, then let the field grow upward as content expands. */}
      <div className="relative">
        {hasDiffComments ? (
          <ComposerGitOpsTopBar
            commentCards={commentCards}
            onSelectDiffComment={onSelectDiffComment}
          />
        ) : null}
        {hasDiffComments ? null : (
          <ComposerGitOpsMessageField
            actionErrorMessage={null}
            actionStatusMessage={actionStatusMessage}
            commitFocused={commitFocused}
            diffCommentError={diffCommentError ?? diffLoadError}
            hasDiffComments={false}
            isGitRepo={isGitRepo}
            hoverToFocus={appSettings.hoverToFocus}
            hoverToBlur={appSettings.hoverToBlur}
            hoverBoundaryRef={composerPanelRef}
            onBlur={() => setCommitFocused(false)}
            onChange={handleCommitMessageChange}
            onFocus={() => setCommitFocused(true)}
            onInput={() => {
              if (actionErrorMessage) {
                setActionErrorMessage(null)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && (dictationActive || dictationTranscribing)) {
                event.preventDefault()
                void cancelDictation()
              }
            }}
            onLayoutChange={onLayoutChange}
            trailingAccessory={trailingActions}
            value={commitMessage}
          />
        )}
      </div>

      {hasDiffComments ? (
        <ComposerGitOpsMessageField
          actionErrorMessage={null}
          actionStatusMessage={actionStatusMessage}
          commitFocused={commitFocused}
          diffCommentError={diffCommentError ?? diffLoadError}
          hasDiffComments
          isGitRepo={isGitRepo}
          hoverToFocus={appSettings.hoverToFocus}
          hoverToBlur={appSettings.hoverToBlur}
          hoverBoundaryRef={composerPanelRef}
          onBlur={() => setCommitFocused(false)}
          onChange={handleCommitMessageChange}
          onFocus={() => setCommitFocused(true)}
          onInput={() => {
            if (actionErrorMessage) {
              setActionErrorMessage(null)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && (dictationActive || dictationTranscribing)) {
              event.preventDefault()
              void cancelDictation()
            }
          }}
          onLayoutChange={onLayoutChange}
          trailingAccessory={trailingActions}
          value={commitMessage}
        />
      ) : null}

      {/* Footer row structure here is mirrored by the prompt composer footer. */}
      <ComposerGitOpsFooter
        composerPanelRef={composerPanelRef}
        diffBaseline={diffBaseline}
        diffRenderMode={diffRenderMode}
        hasOrigin={hasOrigin}
        includeUnstaged={includeUnstaged}
        isGitRepo={isGitRepo}
        onSaveOrigin={handleSaveOrigin}
        onBack={onBack}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        onSwitchBranch={(branchName) => {
          void onAction('workspace.switch-branch', { projectId, value: branchName })
        }}
        onSetRepoUrl={setRepoUrl}
        onToggleIncludeUnstaged={() => setIncludeUnstaged((current) => !current)}
        onTogglePreview={togglePreviewEnabled}
        onTogglePush={() => setPushEnabled((current) => !current)}
        onSaveProjectGitOpsMode={saveProjectGitOpsMode}
        previewEnabled={previewEnabled}
        projectGitState={projectGitState}
        pushEnabled={pushEnabled}
        repoUrl={repoUrl}
      />
    </div>
  )
}
