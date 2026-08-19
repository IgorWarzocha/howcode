import type { CodeViewHandle, FileDiffMetadata } from '@pierre/diffs/react'
import { useCallback, useMemo, useState } from 'react'
import type { ChangeReviewTarget } from '../review/change-review-model'
import type { GitOpsAnnotationMetadata } from '../review/pierre-review-adapter'
import { getDiffFileIdentity } from './diff-file-identity'
import { DIFF_FULL_CONTEXT_EXPANSION_LINE_COUNT } from './diff-panel-content.constants'
import type { DiffFileContentController } from './use-diff-file-content'

type ExpandedFile = { source: FileDiffMetadata }

export type TrailingContextExpansionController = {
  expand: (target: ChangeReviewTarget) => void
  expandedFileKeys: ReadonlySet<string>
  loadFiles: DiffFileContentController['loadFiles']
}

export function useTrailingContextExpansion({
  codeViewRef,
  fileContent,
  files,
}: {
  codeViewRef: React.RefObject<CodeViewHandle<GitOpsAnnotationMetadata> | null>
  fileContent: DiffFileContentController
  files: readonly FileDiffMetadata[]
}): TrailingContextExpansionController {
  const [expandedFiles, setExpandedFiles] = useState<ReadonlyMap<string, ExpandedFile>>(new Map())

  const expandedFileKeys = useMemo(() => {
    const result = new Set<string>()
    for (const file of files) {
      const { fileKey } = getDiffFileIdentity(file)
      const expanded = expandedFiles.get(fileKey)
      if (expanded?.source === file) result.add(fileKey)
    }
    return result
  }, [expandedFiles, files])

  const loadFiles = useCallback<DiffFileContentController['loadFiles']>(
    async (fileDiff) => {
      const loadedFiles = await fileContent.loadFiles(fileDiff)
      const { fileKey } = getDiffFileIdentity(fileDiff)
      setExpandedFiles((current) => {
        const next = new Map(current)
        next.set(fileKey, { source: fileDiff })
        return next
      })
      return loadedFiles
    },
    [fileContent],
  )

  const expand = useCallback(
    (target: ChangeReviewTarget) => {
      const item = codeViewRef.current?.getItem(target.fileKey)
      if (item?.type !== 'diff') return

      const rendered = codeViewRef.current
        ?.getInstance()
        ?.getRenderedItems()
        .find((candidate) => candidate.id === target.fileKey)
      if (rendered?.type !== 'diff') return

      rendered.instance.expandHunk(
        item.fileDiff.hunks.length,
        'up',
        DIFF_FULL_CONTEXT_EXPANSION_LINE_COUNT,
      )
    },
    [codeViewRef],
  )

  return { expand, expandedFileKeys, loadFiles }
}
