import { useCallback, useEffect, useState } from 'react'
import { getDesktopActionErrorMessage } from '../../desktop/action-results'
import { getErrorMessage } from '../../desktop/error-messages'
import type { DesktopActionInvoker, GitOpsMode } from '../../desktop/types'

type GitOpsStatusSink = {
  setErrorMessage: (message: string | null) => void
  setStatusMessage: (message: string | null) => void
}

export function useGitOpsOptions({
  appDefaultMode,
  effectiveMode,
  hasOrigin,
  isGitRepo,
  onAction,
  status,
}: {
  appDefaultMode: GitOpsMode
  effectiveMode: GitOpsMode
  hasOrigin: boolean
  isGitRepo: boolean
  onAction: DesktopActionInvoker
  status: GitOpsStatusSink
}) {
  const [includeUnstaged, setIncludeUnstaged] = useState(true)
  const [previewEnabled, setPreviewEnabled] = useState(true)
  const [previewPendingCommit, setPreviewPendingCommit] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')

  useEffect(() => {
    setPushEnabled(hasOrigin && effectiveMode === 'commit-push')
  }, [effectiveMode, hasOrigin])

  const saveProjectMode = useCallback(
    async (mode: GitOpsMode | null) => {
      if (!isGitRepo) return

      const previousPushEnabled = pushEnabled
      setPushEnabled(
        hasOrigin && (mode === null ? appDefaultMode === 'commit-push' : mode === 'commit-push'),
      )
      status.setErrorMessage(null)

      try {
        const result = await onAction('workspace.commit-options', { gitOpsMode: mode })
        const errorMessage = getDesktopActionErrorMessage(
          result,
          'Could not update the project GitOps default.',
        )
        if (errorMessage) {
          setPushEnabled(previousPushEnabled)
          status.setErrorMessage(errorMessage)
          return
        }
        status.setErrorMessage(null)
        status.setStatusMessage(null)
      } catch (error) {
        setPushEnabled(previousPushEnabled)
        status.setErrorMessage(
          getErrorMessage(error, 'Could not update the project GitOps default.'),
        )
        status.setStatusMessage(null)
      }
    },
    [appDefaultMode, hasOrigin, isGitRepo, onAction, pushEnabled, status],
  )

  const saveOrigin = useCallback(async () => {
    const nextRepoUrl = repoUrl.trim()
    if (!isGitRepo || nextRepoUrl.length === 0) return

    status.setErrorMessage(null)
    try {
      const result = await onAction('workspace.commit-options', { repoUrl: nextRepoUrl })
      const errorMessage = getDesktopActionErrorMessage(
        result,
        'Could not update the repository remote.',
      )
      if (errorMessage) {
        status.setErrorMessage(errorMessage)
        return
      }
      status.setErrorMessage(null)
      status.setStatusMessage(null)
      setRepoUrl('')
    } catch (error) {
      status.setErrorMessage(getErrorMessage(error, 'Could not update the repository remote.'))
      status.setStatusMessage(null)
    }
  }, [isGitRepo, onAction, repoUrl, status])

  const togglePreview = useCallback(() => {
    setPreviewEnabled((current) => !current)
    setPreviewPendingCommit(false)
  }, [])
  const setPreviewPending = useCallback((pending: boolean) => {
    setPreviewPendingCommit(pending)
  }, [])
  const toggleIncludeUnstaged = useCallback(() => {
    setIncludeUnstaged((current) => !current)
  }, [])
  const togglePush = useCallback(() => {
    setPushEnabled((current) => !current)
  }, [])

  return {
    includeUnstaged,
    previewEnabled,
    previewPendingCommit,
    pushEnabled,
    repoUrl,
    saveOrigin,
    saveProjectMode,
    setPreviewPending,
    setRepoUrl,
    toggleIncludeUnstaged,
    togglePreview,
    togglePush,
  }
}
