import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../app-shell/keybinding-events'
import { AnchoredPopoverPanel } from '../../common/popover'
import { ComposerDictationControls } from '../../composer/composer-dictation-controls'
import { useComposerDictation } from '../../composer/useComposerDictation'
import type {
  AppSettings,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
} from '../../desktop/types'
import { getFeatureStatusDataAttributes } from '../../features/feature-status'
import {
  appToneMutedClass,
  appTypeMetaClass,
  appTypeMetaStrongClass,
  composerPopoverExtensionLayerClass,
  composerPopoverPanelClass,
  composerTextActionButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import { ComposerGitOpsFooter } from './composer-git-ops-footer'
import { ComposerGitOpsMessageField } from './composer-git-ops-message-field'
import { ComposerGitOpsTopBar } from './composer-git-ops-top-bar'
import type { SavedDiffComment } from './diff/diffCommentStore'
import { useComposerGitOpsState } from './useComposerGitOpsState'

type ComposerGitOpsSurfaceProps = {
  dictationModelId: string | null
  dictationMaxDurationSeconds: number
  composerPanelRef: RefObject<HTMLDivElement | null>
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  projectGitState: ProjectGitState | null
  parentBranchName?: string | null | undefined
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
  includeUntracked: boolean
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (mode: ProjectDiffRenderMode) => void
  onToggleIncludeUntracked: () => void
  onSendDiffComments: (message?: string | null) => void
  onSelectDiffComment: (filePath: string, commentId: string) => void
  hasPendingDiffComments: boolean
  onDiscardDiffComments: () => void
  onAction: DesktopActionInvoker
  onLayoutChange: () => void
  onBack: () => void
  onActionErrorMessageChange?: (message: string | null) => void
}

function UntrackedScopePopover({ count, onInclude }: { count: number; onInclude: () => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const countLabel = `${count} untracked`

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) return
      if (target instanceof Node && panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  const panel = (
    <AnchoredPopoverPanel
      anchorRef={anchorRef}
      panelRef={panelRef}
      open={open}
      placement="top-center"
      portalClassName={composerPopoverExtensionLayerClass}
      surface={false}
      className={cn(composerPopoverPanelClass, 'w-64 p-2')}
    >
      <div className="grid gap-2 p-1">
        <div className="grid gap-0.5 px-1">
          <div className={appTypeMetaStrongClass}>Untracked files</div>
          <p className={cn(appTypeMetaClass, appToneMutedClass, 'm-0')}>
            {count} file{count === 1 ? ' is' : 's are'} not tracked by git.
          </p>
        </div>
        <button
          type="button"
          className="grid gap-0.5 rounded-md px-2 py-1.5 text-left text-[color:var(--text)] hover:bg-[color:var(--surface-hover)]"
          onClick={() => setOpen(false)}
        >
          <span className={appTypeMetaStrongClass}>Exclude from commit</span>
          <span className={cn(appTypeMetaClass, appToneMutedClass)}>
            Hide from the diff and leave untracked.
          </span>
        </button>
        <button
          type="button"
          className="grid gap-0.5 rounded-md px-2 py-1.5 text-left text-[color:var(--text)] hover:bg-[color:var(--surface-hover)]"
          onClick={() => {
            onInclude()
            setOpen(false)
          }}
        >
          <span className={appTypeMetaStrongClass}>Include in commit</span>
          <span className={cn(appTypeMetaClass, appToneMutedClass)}>
            Show in the diff and add when committing.
          </span>
        </button>
      </div>
    </AnchoredPopoverPanel>
  )

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${composerTextActionButtonClass} border-0 bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
      >
        {countLabel}
      </button>
      {panel}
    </span>
  )
}

export function ComposerGitOpsSurface({
  dictationModelId,
  dictationMaxDurationSeconds,
  composerPanelRef,
  onOpenSettingsView,
  projectGitState,
  parentBranchName,
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
  includeUntracked,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  onToggleIncludeUntracked,
  onSendDiffComments,
  onSelectDiffComment,
  hasPendingDiffComments,
  onDiscardDiffComments,
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
    includeUntracked,
    projectGitState,
  })
  const inputLocked = runningPrimaryAction || diffCommentsSending

  const untrackedFileCount = projectGitState?.untrackedFileCount ?? 0
  const hiddenUntrackedFileCount = includeUntracked ? 0 : untrackedFileCount

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
    if (!(showDictationButton && !inputLocked)) return
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
      showDictationButton={showDictationButton && !inputLocked}
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
      {hiddenUntrackedFileCount > 0 ? (
        <UntrackedScopePopover
          count={hiddenUntrackedFileCount}
          onInclude={() => {
            onToggleIncludeUntracked()
          }}
        />
      ) : null}
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
            leadingAdornment={dictationControls}
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
          leadingAdornment={dictationControls}
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
        includeUntracked={includeUntracked}
        isGitRepo={isGitRepo}
        onSaveOrigin={handleSaveOrigin}
        onBack={onBack}
        hasPendingDiffComments={hasPendingDiffComments}
        onDiscardDiffComments={onDiscardDiffComments}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        onSetRepoUrl={setRepoUrl}
        onToggleIncludeUnstaged={() => setIncludeUnstaged((current) => !current)}
        onToggleIncludeUntracked={onToggleIncludeUntracked}
        onTogglePreview={togglePreviewEnabled}
        onTogglePush={() => setPushEnabled((current) => !current)}
        onSaveProjectGitOpsMode={saveProjectGitOpsMode}
        previewEnabled={previewEnabled}
        projectGitState={projectGitState}
        parentBranchName={parentBranchName}
        pushEnabled={pushEnabled}
        repoUrl={repoUrl}
      />
    </div>
  )
}
