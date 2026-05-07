import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDesktopActionErrorMessage } from '../../../desktop/action-results'
import { getErrorMessage } from '../../../desktop/error-messages'
import type {
  AppSettings,
  DesktopActionInvoker,
  GitOpsMode,
  ProjectGitState,
} from '../../../desktop/types'
import type { SavedDiffComment } from '../diff/diffCommentStore'
import {
  buildGitOpsCommentCards,
  getActionResultCommitted,
  getActionResultError,
  getActionResultMessage,
  getActionResultPreviewed,
  getActionResultPushed,
} from './composer-git-ops.helpers'

function getPrimaryGitOpsActionLabel(input: {
  canCommit: boolean
  diffCommentsSending: boolean
  fileCount: number
  hasDiffComments: boolean
  isGitRepo: boolean
  pushEnabled: boolean
}) {
  if (input.hasDiffComments)
    return input.diffCommentsSending ? 'Sending comments…' : 'Send comments'
  if (!input.isGitRepo) return 'Init git'
  if (input.canCommit || input.fileCount > 0) return input.pushEnabled ? 'Commit & push' : 'Commit'
  return 'Clean'
}

function getCanCommit(input: {
  fileCount: number
  includeUnstaged: boolean
  isGitRepo: boolean
  stagedFileCount: number
}) {
  if (!input.isGitRepo) return false
  return input.includeUnstaged ? input.fileCount > 0 : input.stagedFileCount > 0
}

async function initializeGitRepository(input: {
  onAction: DesktopActionInvoker
  setActionErrorMessage: (message: string | null) => void
}) {
  try {
    const result = await input.onAction('workspace.commit-options')
    const errorMessage = getDesktopActionErrorMessage(result, 'Could not initialize git.')
    input.setActionErrorMessage(errorMessage)
  } catch (error) {
    input.setActionErrorMessage(getErrorMessage(error, 'Could not initialize git.'))
  }
}

function applyCommitActionResult(input: {
  nextMessage: string | null
  result: Awaited<ReturnType<DesktopActionInvoker>>
  setActionErrorMessage: (message: string | null) => void
  setActionStatusMessage: (message: string | null) => void
  setCommitFocused: (focused: boolean) => void
  setCommitMessage: (message: string) => void
  setPersistedCleanMessage: (message: string | null) => void
  setPreviewPendingCommit: (pending: boolean) => void
  trimmedCommitMessage: string
}) {
  if (input.nextMessage) {
    input.setCommitMessage(input.nextMessage)
    input.setCommitFocused(false)
  }
  if (getActionResultPreviewed(input.result)) {
    input.setPreviewPendingCommit(true)
    return
  }
  if (getActionResultCommitted(input.result)) {
    input.setPreviewPendingCommit(false)
    const finalMessage =
      input.nextMessage ??
      (input.trimmedCommitMessage.length > 0 ? input.trimmedCommitMessage : null)
    if (finalMessage) {
      input.setCommitMessage(finalMessage)
      input.setPersistedCleanMessage(finalMessage)
    }
    const resultError = getActionResultError(input.result)
    input.setActionStatusMessage(
      resultError
        ? null
        : getActionResultPushed(input.result)
          ? 'Committed and pushed successfully.'
          : 'Committed successfully.',
    )
  }
  input.setActionErrorMessage(getActionResultError(input.result))
}

export function useComposerGitOpsState({
  diffComments,
  diffCommentsSending,
  onAction,
  onSendDiffComments,
  appSettings,
  projectGitState,
}: {
  diffComments: SavedDiffComment[]
  diffCommentsSending: boolean
  onAction: DesktopActionInvoker
  onSendDiffComments: (message?: string | null) => void
  appSettings: AppSettings
  projectGitState: ProjectGitState | null
}) {
  const [includeUnstaged, setIncludeUnstaged] = useState(true)
  const [previewEnabled, setPreviewEnabled] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [commitFocused, setCommitFocused] = useState(false)
  const [previewPendingCommit, setPreviewPendingCommit] = useState(false)
  const [persistedCleanMessage, setPersistedCleanMessage] = useState<string | null>(null)
  const [runningPrimaryAction, setRunningPrimaryAction] = useState(false)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [actionStatusMessage, setActionStatusMessage] = useState<string | null>(null)
  const [repoUrl, setRepoUrl] = useState('')
  const previousProjectIdRef = useRef<string | null>(projectGitState?.projectId ?? null)
  const commitMessageRef = useRef(commitMessage)

  commitMessageRef.current = commitMessage

  const isGitRepo = projectGitState?.isGitRepo ?? false
  const hasOrigin = projectGitState?.hasOrigin ?? false
  const effectiveGitOpsMode = projectGitState?.gitOpsModeOverride ?? appSettings.gitOpsDefaultMode
  const isGitHubOrigin = projectGitState?.originUrl?.includes('github.com') ?? false
  const isTreeClean = isGitRepo && (projectGitState?.fileCount ?? 0) === 0
  const hasDiffComments = diffComments.length > 0
  const trimmedCommitMessage = commitMessage.trim()
  const canCommit = getCanCommit({
    fileCount: projectGitState?.fileCount ?? 0,
    includeUnstaged,
    isGitRepo,
    stagedFileCount: projectGitState?.stagedFileCount ?? 0,
  })
  const primaryActionLabel = getPrimaryGitOpsActionLabel({
    canCommit,
    diffCommentsSending,
    fileCount: projectGitState?.fileCount ?? 0,
    hasDiffComments,
    isGitRepo,
    pushEnabled,
  })
  const commentCards = useMemo(() => buildGitOpsCommentCards(diffComments), [diffComments])

  useEffect(() => {
    if (!hasOrigin) {
      setPushEnabled(false)
    }
  }, [hasOrigin])

  useEffect(() => {
    setPushEnabled(hasOrigin && effectiveGitOpsMode === 'commit-push')
  }, [effectiveGitOpsMode, hasOrigin])

  useEffect(() => {
    const nextProjectId = projectGitState?.projectId ?? null
    if (previousProjectIdRef.current === nextProjectId) {
      return
    }

    previousProjectIdRef.current = nextProjectId
    setCommitMessage('')
    setCommitFocused(false)
    setPersistedCleanMessage(null)
    setPreviewPendingCommit(false)
    setActionStatusMessage(null)
  }, [projectGitState])

  useEffect(() => {
    if (!isTreeClean && persistedCleanMessage && commitMessage === persistedCleanMessage) {
      setCommitMessage('')
      setPersistedCleanMessage(null)
      setActionStatusMessage(null)
    }
  }, [commitMessage, isTreeClean, persistedCleanMessage])

  const handleCommitMessageChange = useCallback(
    (nextMessage: string) => {
      setCommitMessage(nextMessage)
      if (actionErrorMessage) {
        setActionErrorMessage(null)
      }
      if (actionStatusMessage) {
        setActionStatusMessage(null)
      }
      if (nextMessage.trim().length === 0) {
        setPreviewPendingCommit(false)
      }
      if (persistedCleanMessage && nextMessage !== persistedCleanMessage) {
        setPersistedCleanMessage(null)
      }
    },
    [actionErrorMessage, actionStatusMessage, persistedCleanMessage],
  )

  const saveProjectGitOpsMode = useCallback(
    async (mode: GitOpsMode | null) => {
      if (!isGitRepo) {
        return
      }

      const previousPushEnabled = pushEnabled
      setPushEnabled(
        hasOrigin &&
          (mode === null
            ? appSettings.gitOpsDefaultMode === 'commit-push'
            : mode === 'commit-push'),
      )
      setActionErrorMessage(null)

      try {
        const result = await onAction('workspace.commit-options', { gitOpsMode: mode })
        const gitOpsActionErrorMessage = getDesktopActionErrorMessage(
          result,
          'Could not update the project GitOps default.',
        )
        if (gitOpsActionErrorMessage) {
          setPushEnabled(previousPushEnabled)
          setActionErrorMessage(gitOpsActionErrorMessage)
          return
        }
        setActionErrorMessage(null)
        setActionStatusMessage(null)
      } catch (error) {
        setPushEnabled(previousPushEnabled)
        setActionErrorMessage(
          getErrorMessage(error, 'Could not update the project GitOps default.'),
        )
        setActionStatusMessage(null)
      }
    },
    [appSettings.gitOpsDefaultMode, hasOrigin, isGitRepo, onAction, pushEnabled],
  )

  const setCommitMessageValue = useCallback(
    (value: SetStateAction<string>) => {
      const nextMessage = typeof value === 'function' ? value(commitMessageRef.current) : value

      handleCommitMessageChange(nextMessage)
    },
    [handleCommitMessageChange],
  )

  const handleSaveOrigin = useCallback(async () => {
    const nextRepoUrl = repoUrl.trim()
    if (!isGitRepo || nextRepoUrl.length === 0) {
      return
    }

    setActionErrorMessage(null)

    try {
      const result = await onAction('workspace.commit-options', { repoUrl: nextRepoUrl })
      const saveOriginActionErrorMessage = getDesktopActionErrorMessage(
        result,
        'Could not update the repository remote.',
      )
      if (saveOriginActionErrorMessage) {
        setActionErrorMessage(saveOriginActionErrorMessage)
        return
      }
      setActionErrorMessage(null)
      setActionStatusMessage(null)
      setRepoUrl('')
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error, 'Could not update the repository remote.'))
      setActionStatusMessage(null)
    }
  }, [isGitRepo, onAction, repoUrl])

  const handlePrimaryAction = useCallback(async () => {
    if (hasDiffComments) {
      onSendDiffComments(trimmedCommitMessage)
      return
    }

    if (runningPrimaryAction) {
      return
    }

    if (!isGitRepo) {
      await initializeGitRepository({ onAction, setActionErrorMessage })
      return
    }

    if (!canCommit) {
      return
    }

    const shouldPreview =
      previewEnabled && trimmedCommitMessage.length === 0 && !previewPendingCommit

    setRunningPrimaryAction(true)

    try {
      setActionErrorMessage(null)
      setActionStatusMessage(null)
      const result = await onAction('workspace.commit', {
        includeUnstaged,
        message: trimmedCommitMessage.length > 0 ? trimmedCommitMessage : null,
        preview: shouldPreview,
        push: pushEnabled,
      })

      applyCommitActionResult({
        nextMessage: getActionResultMessage(result),
        result,
        setActionErrorMessage,
        setActionStatusMessage,
        setCommitFocused,
        setCommitMessage,
        setPersistedCleanMessage,
        setPreviewPendingCommit,
        trimmedCommitMessage,
      })
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error, 'Could not commit changes.'))
      setActionStatusMessage(null)
    } finally {
      setRunningPrimaryAction(false)
    }
  }, [
    canCommit,
    hasDiffComments,
    includeUnstaged,
    isGitRepo,
    onAction,
    onSendDiffComments,
    previewEnabled,
    previewPendingCommit,
    pushEnabled,
    runningPrimaryAction,
    trimmedCommitMessage,
  ])

  const togglePreviewEnabled = useCallback(() => {
    setPreviewEnabled((current) => !current)
    setPreviewPendingCommit(false)
  }, [])

  return {
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
    isGitHubOrigin,
    isGitRepo,
    previewEnabled,
    primaryActionLabel,
    projectGitState,
    pushEnabled,
    repoUrl,
    runningPrimaryAction,
    saveProjectGitOpsMode,
    setCommitFocused,
    setActionErrorMessage,
    setIncludeUnstaged,
    setCommitMessageValue,
    setPushEnabled,
    setRepoUrl,
    togglePreviewEnabled,
  }
}
