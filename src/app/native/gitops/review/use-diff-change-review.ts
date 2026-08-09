import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getErrorMessage } from '../../../desktop/error-messages'
import { getDiffFileIdentity } from '../diff/diff-file-identity'
import type { DiffFileContentController } from '../diff/use-diff-file-content'
import type { GitOpsFileActions } from '../edit/gitops-file-actions'
import {
  buildChangeReviewAnnotations,
  type ChangeReviewDecision,
  type ChangeReviewTarget,
  resolveReviewedChange,
} from './change-review-model'
import type { GitOpsAnnotationMetadata } from './pierre-review-adapter'
import { undoReviewedChange } from './undo-reviewed-change'

type ReviewedFile = { source: FileDiffMetadata; value: FileDiffMetadata }
type ChangeReviewMutationState =
  | { kind: 'idle' }
  | { kind: 'undoing'; target: ChangeReviewTarget }
  | { kind: 'error'; message: string }

export type DiffChangeReviewController = {
  annotationsByFile: ReadonlyMap<string, readonly DiffLineAnnotation<GitOpsAnnotationMetadata>[]>
  busy: boolean
  error: string | null
  files: readonly FileDiffMetadata[]
  reviewedFileKeys: ReadonlySet<string>
  undoingTarget: ChangeReviewTarget | null
  reset: (fileKey: string) => void
  resolve: (target: ChangeReviewTarget, decision: ChangeReviewDecision) => Promise<void>
}

export function useDiffChangeReview({
  fileActions,
  fileContent,
  projectId,
  renderableFiles,
}: {
  fileActions: GitOpsFileActions
  fileContent: DiffFileContentController
  projectId: string
  renderableFiles: readonly FileDiffMetadata[]
}): DiffChangeReviewController {
  const [reviewedFiles, setReviewedFiles] = useState<ReadonlyMap<string, ReviewedFile>>(new Map())
  const [mutationState, setMutationState] = useState<ChangeReviewMutationState>({ kind: 'idle' })
  const renderableFilesRef = useRef(renderableFiles)
  const undoInFlightRef = useRef(false)
  useEffect(() => {
    renderableFilesRef.current = renderableFiles
  }, [renderableFiles])

  const files = useMemo(
    () =>
      renderableFiles.map((source) => {
        const { fileKey } = getDiffFileIdentity(source)
        const reviewed = reviewedFiles.get(fileKey)
        return reviewed?.source === source ? reviewed.value : source
      }),
    [renderableFiles, reviewedFiles],
  )

  const annotationsByFile = useMemo(() => {
    const result = new Map<string, DiffLineAnnotation<GitOpsAnnotationMetadata>[]>()
    for (const fileDiff of files) {
      const { fileKey } = getDiffFileIdentity(fileDiff)
      const annotations = buildChangeReviewAnnotations(fileKey, fileDiff)
      if (annotations.length > 0) result.set(fileKey, annotations)
    }
    return result
  }, [files])

  const reviewedFileKeys = useMemo(() => {
    const result = new Set<string>()
    for (const source of renderableFiles) {
      const { fileKey } = getDiffFileIdentity(source)
      if (reviewedFiles.get(fileKey)?.source === source) result.add(fileKey)
    }
    return result
  }, [renderableFiles, reviewedFiles])

  const reset = useCallback((fileKey: string) => {
    setMutationState({ kind: 'idle' })
    setReviewedFiles((current) => {
      if (!current.has(fileKey)) return current
      const next = new Map(current)
      next.delete(fileKey)
      return next
    })
  }, [])

  const resolve = useCallback(
    async (target: ChangeReviewTarget, decision: ChangeReviewDecision) => {
      if (undoInFlightRef.current) return
      const source = renderableFilesRef.current.find(
        (candidate) => getDiffFileIdentity(candidate).fileKey === target.fileKey,
      )
      if (!source) return

      const reviewed = reviewedFiles.get(target.fileKey)
      const fileDiff = reviewed?.source === source ? reviewed.value : source
      if (decision === 'keep') {
        setMutationState({ kind: 'idle' })
        setReviewedFiles((current) => {
          const next = new Map(current)
          next.set(target.fileKey, {
            source,
            value: resolveReviewedChange(fileDiff, target.hunkIndex, decision),
          })
          return next
        })
        return
      }

      undoInFlightRef.current = true
      setMutationState({ kind: 'undoing', target })
      try {
        const result = await undoReviewedChange({
          fileActions,
          fileContent,
          fileDiff,
          hunkIndex: target.hunkIndex,
          projectId,
        })
        if (result.kind === 'failed') {
          setMutationState({ kind: 'error', message: result.message })
          return
        }
        setReviewedFiles((current) => {
          const next = new Map(current)
          next.set(target.fileKey, { source, value: result.fileDiff })
          return next
        })
        setMutationState({ kind: 'idle' })
      } catch (error) {
        setMutationState({
          kind: 'error',
          message: getErrorMessage(error, 'Could not undo this change.'),
        })
      } finally {
        undoInFlightRef.current = false
      }
    },
    [fileActions, fileContent, projectId, reviewedFiles],
  )

  return {
    annotationsByFile,
    busy: mutationState.kind === 'undoing',
    error: mutationState.kind === 'error' ? mutationState.message : null,
    files,
    reset,
    resolve,
    reviewedFileKeys,
    undoingTarget: mutationState.kind === 'undoing' ? mutationState.target : null,
  }
}
