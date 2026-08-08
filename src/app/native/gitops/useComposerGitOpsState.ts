import { useCallback, useMemo, useState } from 'react'
import { getDesktopActionErrorMessage } from '../../desktop/action-results'
import { getErrorMessage } from '../../desktop/error-messages'
import type { AppSettings, DesktopActionInvoker, ProjectGitState } from '../../desktop/types'
import {
  canCommitGitOps,
  getGitOpsCommitOutcome,
  getPrimaryGitOpsActionLabel,
} from './composer-primary-action'
import { buildGitOpsCommentCards } from './review/review-comment-card'
import type { SavedReviewComment } from './review/review-model'
import { useGitOpsMessage } from './use-git-ops-message'
import { useGitOpsOptions } from './use-git-ops-options'

async function initializeGitRepository(input: {
  onAction: DesktopActionInvoker
  setErrorMessage: (message: string | null) => void
}) {
  try {
    const result = await input.onAction('workspace.commit-options')
    input.setErrorMessage(getDesktopActionErrorMessage(result, 'Could not initialize git.'))
  } catch (error) {
    input.setErrorMessage(getErrorMessage(error, 'Could not initialize git.'))
  }
}

export function useComposerGitOpsState({
  diffComments,
  diffCommentsSending,
  onAction,
  onSendDiffComments,
  appSettings,
  includeUntracked,
  projectGitState,
}: {
  diffComments: readonly SavedReviewComment[]
  diffCommentsSending: boolean
  onAction: DesktopActionInvoker
  onSendDiffComments: (message?: string | null) => Promise<void>
  appSettings: AppSettings
  includeUntracked: boolean
  projectGitState: ProjectGitState | null
}) {
  const [runningPrimaryAction, setRunningPrimaryAction] = useState(false)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [actionStatusMessage, setActionStatusMessage] = useState<string | null>(null)
  const isGitRepo = projectGitState?.isGitRepo ?? false
  const hasOrigin = projectGitState?.hasOrigin ?? false
  const hasDiffComments = diffComments.length > 0

  const statusSink = useMemo(
    () => ({
      setErrorMessage: setActionErrorMessage,
      setStatusMessage: setActionStatusMessage,
    }),
    [],
  )
  const options = useGitOpsOptions({
    appDefaultMode: appSettings.gitOpsDefaultMode,
    effectiveMode: projectGitState?.gitOpsModeOverride ?? appSettings.gitOpsDefaultMode,
    hasOrigin,
    isGitRepo,
    onAction,
    status: statusSink,
  })
  const message = useGitOpsMessage({
    isTreeClean: isGitRepo && (projectGitState?.fileCount ?? 0) === 0,
    projectId: projectGitState?.projectId ?? null,
    setPreviewPending: options.setPreviewPending,
    status: {
      ...statusSink,
      errorMessage: actionErrorMessage,
      statusMessage: actionStatusMessage,
    },
  })
  const { applyCommitOutcome, field: messageField, trimmedValue } = message
  const { includeUnstaged, previewEnabled, previewPendingCommit, pushEnabled } = options
  const canCommit = canCommitGitOps({
    fileCount: projectGitState?.fileCount ?? 0,
    includeUnstaged,
    includeUntracked,
    isGitRepo,
    stagedFileCount: projectGitState?.stagedFileCount ?? 0,
    untrackedFileCount: projectGitState?.untrackedFileCount ?? 0,
  })
  const primaryActionLabel = getPrimaryGitOpsActionLabel({
    canCommit,
    diffCommentsSending,
    hasDiffComments,
    isGitRepo,
    pushEnabled,
  })
  const commentCards = useMemo(() => buildGitOpsCommentCards(diffComments), [diffComments])

  const handleCommitAction = useCallback(async () => {
    if (runningPrimaryAction || !canCommit) return

    const shouldPreview = previewEnabled && trimmedValue.length === 0 && !previewPendingCommit
    setRunningPrimaryAction(true)

    try {
      setActionErrorMessage(null)
      setActionStatusMessage(null)
      const result = await onAction('workspace.commit', {
        includeUnstaged,
        includeUntracked,
        message: trimmedValue.length > 0 ? trimmedValue : null,
        preview: shouldPreview,
        push: pushEnabled,
      })
      applyCommitOutcome(getGitOpsCommitOutcome(result, trimmedValue))
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error, 'Could not commit changes.'))
      setActionStatusMessage(null)
    } finally {
      setRunningPrimaryAction(false)
    }
  }, [
    applyCommitOutcome,
    canCommit,
    includeUnstaged,
    includeUntracked,
    onAction,
    previewEnabled,
    previewPendingCommit,
    pushEnabled,
    runningPrimaryAction,
    trimmedValue,
  ])

  const handlePrimaryAction = useCallback(async () => {
    if (hasDiffComments) {
      await onSendDiffComments(trimmedValue)
      return
    }
    if (runningPrimaryAction) return
    if (!isGitRepo) {
      await initializeGitRepository({ onAction, setErrorMessage: setActionErrorMessage })
      return
    }
    await handleCommitAction()
  }, [
    handleCommitAction,
    hasDiffComments,
    isGitRepo,
    trimmedValue,
    onAction,
    onSendDiffComments,
    runningPrimaryAction,
  ])

  return {
    message: messageField,
    options: {
      includeUnstaged: options.includeUnstaged,
      previewEnabled: options.previewEnabled,
      pushEnabled: options.pushEnabled,
      repoUrl: options.repoUrl,
      saveOrigin: options.saveOrigin,
      saveProjectMode: options.saveProjectMode,
      setRepoUrl: options.setRepoUrl,
      toggleIncludeUnstaged: options.toggleIncludeUnstaged,
      togglePreview: options.togglePreview,
      togglePush: options.togglePush,
    },
    primaryAction: {
      canCommit,
      label: primaryActionLabel,
      run: handlePrimaryAction,
      running: runningPrimaryAction,
    },
    repository: {
      hasOrigin,
      isGitRepo,
    },
    review: {
      commentCards,
      hasComments: hasDiffComments,
    },
    status: {
      errorMessage: actionErrorMessage,
      setErrorMessage: setActionErrorMessage,
      statusMessage: actionStatusMessage,
    },
  }
}

export type ComposerGitOpsState = ReturnType<typeof useComposerGitOpsState>
