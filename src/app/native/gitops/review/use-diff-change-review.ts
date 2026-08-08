import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDiffFileIdentity } from '../diff/diff-file-identity'
import {
  buildChangeReviewAnnotations,
  type ChangeReviewDecision,
  type ChangeReviewTarget,
  resolveReviewedChange,
} from './change-review-model'
import type { GitOpsAnnotationMetadata } from './pierre-review-adapter'

type ReviewedFile = { source: FileDiffMetadata; value: FileDiffMetadata }

export type DiffChangeReviewController = {
  annotationsByFile: ReadonlyMap<string, readonly DiffLineAnnotation<GitOpsAnnotationMetadata>[]>
  files: readonly FileDiffMetadata[]
  resolve: (target: ChangeReviewTarget, decision: ChangeReviewDecision) => void
}

export function useDiffChangeReview(
  renderableFiles: readonly FileDiffMetadata[],
): DiffChangeReviewController {
  const [reviewedFiles, setReviewedFiles] = useState<ReadonlyMap<string, ReviewedFile>>(new Map())
  const renderableFilesRef = useRef(renderableFiles)
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

  const resolve = useCallback((target: ChangeReviewTarget, decision: ChangeReviewDecision) => {
    const source = renderableFilesRef.current.find(
      (fileDiff) => getDiffFileIdentity(fileDiff).fileKey === target.fileKey,
    )
    if (!source) return
    setReviewedFiles((current) => {
      const reviewed = current.get(target.fileKey)
      const fileDiff = reviewed?.source === source ? reviewed.value : source
      const next = new Map(current)
      next.set(target.fileKey, {
        source,
        value: resolveReviewedChange(fileDiff, target.hunkIndex, decision),
      })
      return next
    })
  }, [])

  return { annotationsByFile, files, resolve }
}
