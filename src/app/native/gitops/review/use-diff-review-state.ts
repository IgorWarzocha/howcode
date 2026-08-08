import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import {
  type ReviewAnnotationMetadata,
  reviewTargetToPierreAnnotation,
  reviewTargetToPierreSelection,
} from './pierre-review-adapter'
import type { ReviewDraft, SavedReviewComment } from './review-model'
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
  const [draftComment, setDraftComment] = useState<ReviewDraft | null>(null)
  const [hydratedContextId, setHydratedContextId] = useState<string | null>(null)
  const writingStoreRef = useRef(false)

  const reviewContextId = useMemo(
    () => getReviewContextId({ baseline, includeUntracked, projectId }),
    [baseline, includeUntracked, projectId],
  )

  useEffect(() => {
    if (!reviewContextId) {
      setSavedComments([])
      setDraftComment(null)
      setHydratedContextId(null)
      return
    }

    const syncFromStore = () => {
      if (writingStoreRef.current) return
      const persistedContext = reviewStore.getContext(reviewContextId)
      setSavedComments(persistedContext?.comments ?? [])
      setDraftComment(persistedContext?.draft ?? null)
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

  const draftTarget = draftComment?.target ?? null
  const draftSelectedLines = useMemo(
    () => (draftTarget ? reviewTargetToPierreSelection(draftTarget) : null),
    [draftTarget],
  )

  const commentAnnotationsByFile = useMemo(() => {
    const next = new Map<string, DiffLineAnnotation<ReviewAnnotationMetadata>[]>()

    for (const comment of savedComments) {
      const entries = next.get(comment.target.fileKey) ?? []
      entries.push(
        reviewTargetToPierreAnnotation({
          id: comment.id,
          body: comment.body,
          kind: 'comment',
          target: comment.target,
        }),
      )
      next.set(comment.target.fileKey, entries)
    }

    if (draftTarget) {
      const entries = next.get(draftTarget.fileKey) ?? []
      const anchor =
        draftTarget.kind === 'line-range'
          ? `${draftTarget.start.side}:${draftTarget.start.lineNumber}`
          : 'file'
      entries.push(
        reviewTargetToPierreAnnotation({
          id: `draft:${draftTarget.fileKey}:${anchor}`,
          body: '',
          kind: 'draft',
          target: draftTarget,
        }),
      )
      next.set(draftTarget.fileKey, entries)
    }

    return next
  }, [draftTarget, savedComments])

  const annotationCountByFile = useMemo(
    () =>
      new Map(
        Array.from(commentAnnotationsByFile, ([fileKey, annotations]) => [
          fileKey,
          annotations.length,
        ]),
      ),
    [commentAnnotationsByFile],
  )

  const persistDraftComment = useCallback(() => {
    const nextBody = draftComment?.body.trim() ?? ''
    if (!draftComment || nextBody.length === 0) return

    const targetAnchor =
      draftComment.target.kind === 'line-range'
        ? `${draftComment.target.start.side}:${draftComment.target.start.lineNumber}`
        : 'file'
    setSavedComments((current) => [
      ...current,
      {
        ...draftComment,
        id: `${draftComment.target.fileKey}:${targetAnchor}:${Date.now()}`,
        body: nextBody,
        createdAt: new Date().toISOString(),
      },
    ])
    setDraftComment(null)
  }, [draftComment])

  const removeComment = useCallback((commentId: string) => {
    setSavedComments((current) => current.filter((comment) => comment.id !== commentId))
  }, [])

  return {
    annotationCountByFile,
    commentAnnotationsByFile,
    draftComment,
    draftSelectedLines,
    draftTarget,
    hasCommentContext: reviewContextId !== null,
    persistDraftComment,
    removeComment,
    savedComments,
    setDraftComment,
  }
}
