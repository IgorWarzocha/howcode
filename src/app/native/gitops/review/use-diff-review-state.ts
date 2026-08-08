import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import { buildReviewAnnotations } from './review-annotations'
import {
  getReviewInteractionDraft,
  getReviewInteractionTarget,
  idleReviewInteraction,
  reduceReviewInteraction,
} from './review-interaction'
import {
  getReviewTargetKey,
  type LineRangeReviewTarget,
  type ReviewTarget,
  type SavedReviewComment,
} from './review-model'
import { getReviewContextId, reviewStore } from './review-store'

export function useDiffReviewState({
  baseline,
  includeUntracked,
  projectId,
}: {
  baseline: ProjectDiffBaseline | null
  includeUntracked: boolean
  projectId: string
}) {
  const [savedComments, setSavedComments] = useState<SavedReviewComment[]>([])
  const [interaction, dispatchInteraction] = useReducer(
    reduceReviewInteraction,
    idleReviewInteraction,
  )
  const [hydratedContextId, setHydratedContextId] = useState<string | null>(null)
  const writingStoreRef = useRef(false)
  const draftComment = getReviewInteractionDraft(interaction)

  const reviewContextId = useMemo(
    () => getReviewContextId({ baseline, includeUntracked, projectId }),
    [baseline, includeUntracked, projectId],
  )

  useEffect(() => {
    if (!reviewContextId) {
      setSavedComments([])
      dispatchInteraction({ type: 'hydrate', draft: null })
      setHydratedContextId(null)
      return
    }

    const syncFromStore = () => {
      if (writingStoreRef.current) return
      const persistedContext = reviewStore.getContext(reviewContextId)
      setSavedComments(persistedContext?.comments ?? [])
      dispatchInteraction({ type: 'hydrate', draft: persistedContext?.draft ?? null })
      setHydratedContextId(reviewContextId)
    }

    syncFromStore()
    return reviewStore.subscribe(syncFromStore)
  }, [reviewContextId])

  useEffect(() => {
    if (!reviewContextId || hydratedContextId !== reviewContextId) return
    writingStoreRef.current = true
    reviewStore.setContext(reviewContextId, { comments: savedComments, draft: draftComment })
    writingStoreRef.current = false
  }, [draftComment, hydratedContextId, reviewContextId, savedComments])

  const annotationsByFile = useMemo(
    () => buildReviewAnnotations({ comments: savedComments, interaction }),
    [interaction, savedComments],
  )

  const persistDraftComment = useCallback(() => {
    if (interaction.kind !== 'draft') return
    const nextBody = interaction.draft.body.trim()
    if (nextBody.length === 0) return

    setSavedComments((current) => [
      ...current,
      {
        ...interaction.draft,
        id: `${getReviewTargetKey(interaction.draft.target)}:${Date.now()}`,
        body: nextBody,
        createdAt: new Date().toISOString(),
      },
    ])
    dispatchInteraction({ type: 'cancel' })
  }, [interaction])

  const removeComment = useCallback((commentId: string) => {
    setSavedComments((current) => current.filter((comment) => comment.id !== commentId))
  }, [])

  const selectTarget = useCallback((target: LineRangeReviewTarget | null) => {
    dispatchInteraction({ type: 'select', target })
  }, [])
  const openDraft = useCallback((target: ReviewTarget) => {
    dispatchInteraction({ type: 'start-draft', target })
  }, [])
  const setDraftBody = useCallback((body: string) => {
    dispatchInteraction({ type: 'set-draft-body', body })
  }, [])
  const cancelInteraction = useCallback(() => dispatchInteraction({ type: 'cancel' }), [])

  return {
    annotationsByFile,
    comments: {
      items: savedComments,
      remove: removeComment,
    },
    draft: {
      comment: draftComment,
      open: openDraft,
      persist: persistDraftComment,
      setBody: setDraftBody,
    },
    interaction: {
      cancel: cancelInteraction,
      select: selectTarget,
      target: getReviewInteractionTarget(interaction),
    },
  }
}
