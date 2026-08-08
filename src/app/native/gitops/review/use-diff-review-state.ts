import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import {
  type GitOpsAnnotationMetadata,
  reanchorReviewTargetFromPierreAnnotation,
} from './pierre-review-adapter'
import { buildReviewAnnotations } from './review-annotations'
import {
  getReviewInteractionDraft,
  getReviewInteractionTarget,
  idleReviewInteraction,
  reduceReviewInteraction,
} from './review-interaction'
import {
  getReviewTargetKey,
  isSameReviewTarget,
  type LineRangeReviewTarget,
  type ReviewTarget,
  type SavedReviewComment,
} from './review-model'
import { getReviewContextId, reviewStore } from './review-store'

function getReanchoredReview(annotation: DiffLineAnnotation<GitOpsAnnotationMetadata>) {
  const metadata = annotation.metadata.gitOps
  if (metadata.kind !== 'review') return null
  const target = reanchorReviewTargetFromPierreAnnotation(annotation)
  return target ? { review: metadata.review, target } : null
}

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
  const reanchorAnnotations = useCallback(
    (annotations: readonly DiffLineAnnotation<GitOpsAnnotationMetadata>[]) => {
      const savedTargets = new Map<string, ReviewTarget>()
      for (const annotation of annotations) {
        const reanchored = getReanchoredReview(annotation)
        if (!reanchored) continue
        const { review, target: nextTarget } = reanchored
        if (review.kind === 'comment') savedTargets.set(review.id, nextTarget)
        if (review.kind !== 'comment') {
          dispatchInteraction({ type: 'reanchor', from: review.target, to: nextTarget })
        }
      }
      if (savedTargets.size === 0) return
      setSavedComments((current) => {
        let changed = false
        const next = current.map((comment) => {
          const target = savedTargets.get(comment.id)
          if (!target || isSameReviewTarget(comment.target, target)) return comment
          changed = true
          return { ...comment, target }
        })
        return changed ? next : current
      })
    },
    [],
  )

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
    reanchorAnnotations,
  }
}
