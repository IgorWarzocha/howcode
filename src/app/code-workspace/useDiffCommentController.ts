import {
  buildDiffCommentPrompt,
  diffCommentStore,
  getDiffCommentContextId,
  type SavedDiffComment,
} from '@howcode/native-gitops'
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { getDesktopActionErrorMessage } from '../desktop/action-results'
import type { ProjectDiffBaseline } from '../desktop/types'

function getDiffCommentSendError(result: Awaited<ReturnType<AppShellController['handleAction']>>) {
  return getDesktopActionErrorMessage(result, 'Could not send comments to the agent.')
}

function hasDiffCommentsContext(
  context: ReturnType<typeof diffCommentStore.getContext>,
): context is NonNullable<ReturnType<typeof diffCommentStore.getContext>> {
  return context !== null && context !== undefined && context.comments.length > 0
}

async function sendDiffCommentsToComposer(input: {
  context: NonNullable<ReturnType<typeof diffCommentStore.getContext>>
  diffCommentContextId: string
  handleAction: AppShellController['handleAction']
  message?: string | null | undefined
  shellState: AppShellController['shellState']
}): Promise<{ ok: boolean; error: string | null }> {
  const streamingBehaviorPreference =
    input.shellState?.appSettings.composerStreamingBehavior ?? 'followUp'
  const result = await input.handleAction('composer.send', {
    text: buildDiffCommentPrompt({ comments: input.context.comments, instruction: input.message }),
    streamingBehavior: streamingBehaviorPreference,
  })

  const actionErrorMessage = getDiffCommentSendError(result)
  if (actionErrorMessage) return { ok: false, error: actionErrorMessage }
  if (result?.result?.composerSendOutcome === 'stopped') return { ok: false, error: null }

  const sentCommentIds = new Set(input.context.comments.map((comment) => comment.id))
  const latestContext = diffCommentStore.getContext(input.diffCommentContextId)
  if (latestContext) {
    diffCommentStore.setContext(input.diffCommentContextId, {
      comments: latestContext.comments.filter((comment) => !sentCommentIds.has(comment.id)),
      draft: latestContext.draft,
    })
  }
  return { ok: true, error: null }
}

export function useDiffCommentController({
  baseline,
  composerProjectId,
  handleAction,
  handleOpenWorktreeDiffFile,
  includeUntracked,
  setComposerPromptResetKey,
  shellState,
}: {
  baseline: ProjectDiffBaseline | null
  composerProjectId: string
  handleAction: AppShellController['handleAction']
  handleOpenWorktreeDiffFile: (filePath: string) => void
  setComposerPromptResetKey: Dispatch<SetStateAction<number>>
  shellState: AppShellController['shellState']
  includeUntracked: boolean
}) {
  const [diffComments, setDiffComments] = useState<SavedDiffComment[]>([])
  const [diffCommentCount, setDiffCommentCount] = useState(0)
  const [hasPendingDiffComments, setHasPendingDiffComments] = useState(false)
  const [selectedDiffCommentId, setSelectedDiffCommentId] = useState<string | null>(null)
  const [selectedDiffCommentJumpKey, setSelectedDiffCommentJumpKey] = useState(0)
  const [diffCommentsSending, setDiffCommentsSending] = useState(false)
  const [diffCommentError, setDiffCommentError] = useState<string | null>(null)
  const diffCommentContextId = useMemo(
    () => getDiffCommentContextId({ baseline, includeUntracked, projectId: composerProjectId }),
    [baseline, composerProjectId, includeUntracked],
  )

  useEffect(() => {
    const syncCommentCount = () => {
      if (!diffCommentContextId) {
        setDiffComments([])
        setDiffCommentCount(0)
        setHasPendingDiffComments(false)
        return
      }

      const context = diffCommentStore.getContext(diffCommentContextId)
      const nextComments = context?.comments ?? []
      setDiffComments(nextComments)
      setDiffCommentCount(nextComments.length)
      setHasPendingDiffComments(nextComments.length > 0 || Boolean(context?.draft))
    }

    setSelectedDiffCommentId(null)
    setSelectedDiffCommentJumpKey(0)
    syncCommentCount()
    return diffCommentStore.subscribe(syncCommentCount)
  }, [diffCommentContextId])

  const handleSendDiffComments = async (message?: string | null) => {
    if (!diffCommentContextId || diffCommentsSending) return false
    const context = diffCommentStore.getContext(diffCommentContextId)
    if (!hasDiffCommentsContext(context)) return false

    setDiffCommentsSending(true)
    setDiffCommentError(null)
    setSelectedDiffCommentId(null)

    try {
      const result = await sendDiffCommentsToComposer({
        context,
        diffCommentContextId,
        handleAction,
        message,
        shellState,
      })
      setDiffCommentError(result.error)
      if (result.ok) setComposerPromptResetKey((current) => current + 1)
      return result.ok
    } catch (error) {
      setDiffCommentError(
        error instanceof Error ? error.message : 'Could not send comments to the agent.',
      )
      return false
    } finally {
      setDiffCommentsSending(false)
    }
  }

  const handleSelectDiffComment = (filePath: string, commentId: string) => {
    setSelectedDiffCommentId(commentId)
    setSelectedDiffCommentJumpKey((current) => current + 1)
    handleOpenWorktreeDiffFile(filePath)
  }

  const handleDiscardDiffComments = () => {
    if (!diffCommentContextId) return
    diffCommentStore.clearContext(diffCommentContextId)
  }

  return {
    diffCommentCount,
    diffCommentError,
    diffComments,
    diffCommentsSending,
    handleSelectDiffComment,
    handleDiscardDiffComments,
    handleSendDiffComments,
    hasPendingDiffComments,
    selectedDiffCommentId,
    selectedDiffCommentJumpKey,
  }
}
