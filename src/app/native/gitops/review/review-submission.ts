import { getDesktopActionErrorMessage } from '../../../desktop/action-results'
import { getErrorMessage } from '../../../desktop/error-messages'
import type { ComposerStreamingBehavior, DesktopActionInvoker } from '../../../desktop/types'
import { buildReviewPrompt } from './review-prompt'
import type { ReviewContext, ReviewStore } from './review-store'

export async function sendReviewCommentsToComposer({
  context,
  contextId,
  handleAction,
  instruction,
  store,
  streamingBehavior,
}: {
  context: ReviewContext
  contextId: string
  handleAction: DesktopActionInvoker
  instruction?: string | null | undefined
  store: ReviewStore
  streamingBehavior: ComposerStreamingBehavior
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const result = await handleAction('composer.send', {
      text: buildReviewPrompt({ comments: context.comments, instruction }),
      streamingBehavior,
    })
    const actionError = getDesktopActionErrorMessage(
      result,
      'Could not send comments to the agent.',
    )
    if (actionError) return { ok: false, error: actionError }
    if (result?.result?.composerSendOutcome === 'stopped') return { ok: false, error: null }

    const sentCommentIds = new Set(context.comments.map((comment) => comment.id))
    const latestContext = store.getContext(contextId)
    if (latestContext) {
      store.setContext(contextId, {
        comments: latestContext.comments.filter((comment) => !sentCommentIds.has(comment.id)),
        draft: latestContext.draft,
      })
    }
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, 'Could not send comments to the agent.') }
  }
}
