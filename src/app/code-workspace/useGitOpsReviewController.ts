import {
  type GitOpsReviewController,
  getReviewContextId,
  type ReviewContext,
  reviewStore,
  type SavedReviewComment,
  sendReviewCommentsToComposer,
} from '@howcode/native-gitops'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import type { ProjectDiffBaseline } from '../desktop/types'

function hasSavedComments(context: ReviewContext | null): context is ReviewContext {
  return Boolean(context && context.comments.length > 0)
}

export function useGitOpsReviewController({
  baseline,
  composerProjectId,
  handleAction,
  handleOpenWorktreeDiffFile,
  includeUntracked,
  shellState,
}: {
  baseline: ProjectDiffBaseline | null
  composerProjectId: string
  handleAction: AppShellController['desktop']['handleAction']
  handleOpenWorktreeDiffFile: (filePath: string) => void
  shellState: AppShellController['desktop']['shellState']
  includeUntracked: boolean
}): GitOpsReviewController {
  const [comments, setComments] = useState<SavedReviewComment[]>([])
  const [hasPendingReview, setHasPendingReview] = useState(false)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [selectedCommentJumpKey, setSelectedCommentJumpKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contextId = useMemo(
    () => getReviewContextId({ baseline, includeUntracked, projectId: composerProjectId }),
    [baseline, composerProjectId, includeUntracked],
  )

  useEffect(() => {
    const syncReview = () => {
      if (!contextId) {
        setComments([])
        setHasPendingReview(false)
        return
      }

      const context = reviewStore.getContext(contextId)
      setComments(context?.comments ?? [])
      setHasPendingReview(Boolean(context && (context.comments.length > 0 || context.draft)))
    }

    setSelectedCommentId(null)
    setSelectedCommentJumpKey(0)
    syncReview()
    return reviewStore.subscribe(syncReview)
  }, [contextId])

  const send = useCallback(
    async (instruction?: string | null) => {
      if (!contextId || sending) return false
      const context = reviewStore.getContext(contextId)
      if (!hasSavedComments(context)) return false

      setSending(true)
      setError(null)
      setSelectedCommentId(null)
      try {
        const result = await sendReviewCommentsToComposer({
          context,
          contextId,
          handleAction,
          instruction,
          store: reviewStore,
          streamingBehavior: shellState?.appSettings.composerStreamingBehavior ?? 'followUp',
        })
        setError(result.error)
        return result.ok
      } finally {
        setSending(false)
      }
    },
    [contextId, handleAction, sending, shellState?.appSettings.composerStreamingBehavior],
  )

  const select = useCallback(
    (commentId: string) => {
      const selected = comments.find((comment) => comment.id === commentId)
      if (!selected) return
      setSelectedCommentId(commentId)
      setSelectedCommentJumpKey((current) => current + 1)
      handleOpenWorktreeDiffFile(selected.target.filePath)
    },
    [comments, handleOpenWorktreeDiffFile],
  )

  const discard = useCallback(() => {
    if (contextId) reviewStore.clearContext(contextId)
  }, [contextId])

  return useMemo(
    () => ({
      comments,
      error,
      sending,
      hasPendingReview,
      selection: { commentId: selectedCommentId, jumpKey: selectedCommentJumpKey },
      discard,
      select,
      send,
    }),
    [
      comments,
      discard,
      error,
      hasPendingReview,
      select,
      selectedCommentId,
      selectedCommentJumpKey,
      send,
      sending,
    ],
  )
}
