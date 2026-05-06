import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import type { AppShellController } from '../../app-shell/useAppShellController'
import { buildDiffCommentPrompt } from '../../components/workspace/diff/diffCommentPrompt'
import {
  diffCommentStore,
  getDiffCommentContextId,
  type SavedDiffComment,
} from '../../components/workspace/diff/diffCommentStore'
import { getDesktopActionErrorMessage } from '../../desktop/action-results'

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
}) {
  const streamingBehaviorPreference =
    input.shellState?.appSettings.composerStreamingBehavior ?? 'followUp'
  const result = await input.handleAction('composer.send', {
    text: buildDiffCommentPrompt({ comments: input.context.comments, instruction: input.message }),
    streamingBehavior: streamingBehaviorPreference,
  })

  const actionErrorMessage = getDiffCommentSendError(result)
  if (actionErrorMessage) return actionErrorMessage
  if (result?.result?.composerSendOutcome !== 'stopped') {
    diffCommentStore.clearContext(input.diffCommentContextId)
  }
  return null
}

export function useDiffCommentController({
  composerProjectId,
  handleAction,
  handleOpenWorktreeDiffFile,
  setComposerPromptResetKey,
  shellState,
}: {
  composerProjectId: string
  handleAction: AppShellController['handleAction']
  handleOpenWorktreeDiffFile: (filePath: string) => void
  setComposerPromptResetKey: Dispatch<SetStateAction<number>>
  shellState: AppShellController['shellState']
}) {
  const [diffComments, setDiffComments] = useState<SavedDiffComment[]>([])
  const [diffCommentCount, setDiffCommentCount] = useState(0)
  const [selectedDiffCommentId, setSelectedDiffCommentId] = useState<string | null>(null)
  const [selectedDiffCommentJumpKey, setSelectedDiffCommentJumpKey] = useState(0)
  const [diffCommentsSending, setDiffCommentsSending] = useState(false)
  const [diffCommentError, setDiffCommentError] = useState<string | null>(null)
  const diffCommentContextId = useMemo(
    () => getDiffCommentContextId({ projectId: composerProjectId }),
    [composerProjectId],
  )

  useEffect(() => {
    const syncCommentCount = () => {
      if (!diffCommentContextId) {
        setDiffComments([])
        setDiffCommentCount(0)
        return
      }

      const nextComments = diffCommentStore.getContext(diffCommentContextId)?.comments ?? []
      setDiffComments(nextComments)
      setDiffCommentCount(nextComments.length)
    }

    setSelectedDiffCommentId(null)
    setSelectedDiffCommentJumpKey(0)
    syncCommentCount()
    return diffCommentStore.subscribe(syncCommentCount)
  }, [diffCommentContextId])

  const handleSendDiffComments = async (message?: string | null) => {
    if (!diffCommentContextId || diffCommentsSending) return
    const context = diffCommentStore.getContext(diffCommentContextId)
    if (!hasDiffCommentsContext(context)) return

    setDiffCommentsSending(true)
    setDiffCommentError(null)
    setSelectedDiffCommentId(null)
    setComposerPromptResetKey((current) => current + 1)

    try {
      setDiffCommentError(
        await sendDiffCommentsToComposer({
          context,
          diffCommentContextId,
          handleAction,
          message,
          shellState,
        }),
      )
    } catch (error) {
      setDiffCommentError(
        error instanceof Error ? error.message : 'Could not send comments to the agent.',
      )
    } finally {
      setDiffCommentsSending(false)
    }
  }

  const handleSelectDiffComment = (filePath: string, commentId: string) => {
    setSelectedDiffCommentId(commentId)
    setSelectedDiffCommentJumpKey((current) => current + 1)
    handleOpenWorktreeDiffFile(filePath)
  }

  return {
    diffCommentCount,
    diffCommentError,
    diffComments,
    diffCommentsSending,
    handleSelectDiffComment,
    handleSendDiffComments,
    selectedDiffCommentId,
    selectedDiffCommentJumpKey,
  }
}
