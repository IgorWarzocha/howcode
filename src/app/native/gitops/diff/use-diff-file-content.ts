import {
  type FileContents,
  type FileDiffContentsLoader,
  type FileDiffLoadedFiles,
  type FileDiffMetadata,
  hydratePartialDiff,
} from '@pierre/diffs'
import { useCallback, useMemo, useState } from 'react'
import { getErrorMessage } from '../../../desktop/error-messages'
import type {
  ProjectDiffFileContentIssue,
  ProjectDiffResolvedBaseline,
  ProjectDiffTextFile,
} from '../../../desktop/types'
import { getProjectDiffFileContentsQuery } from '../../../query/desktop-query'
import { resolveDiffFilePath, resolveFileDiffPath } from './diff-panel-content.helpers'

export type DiffFileContentController = {
  loadFiles: FileDiffContentsLoader
  prepareWrite: (fileDiff: FileDiffMetadata) => Promise<{
    path: string
    revision: string
  }>
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

function describeIssue(issue: ProjectDiffFileContentIssue) {
  const side = issue.side === 'old' ? 'baseline' : 'worktree'
  switch (issue.kind) {
    case 'invalid-path':
      return `Could not expand ${issue.path}: the ${side} path is invalid.`
    case 'missing':
      return `Could not expand ${issue.path}: the ${side} file is missing.`
    case 'not-file':
      return `Could not expand ${issue.path}: the ${side} path is not a file.`
    case 'binary':
      return `Could not expand ${issue.path}: the ${side} file is binary or is not UTF-8 text.`
    case 'too-large':
      return `Could not expand ${issue.path}: the ${side} file is ${formatBytes(issue.size ?? 0)}; the limit is ${formatBytes(issue.maxBytes ?? 0)}.`
    case 'changed':
      return `Could not expand ${issue.path}: the worktree file changed while it was being read.`
    default:
      return `Could not expand ${issue.path}.`
  }
}

function toPierreFile(projectId: string, file: ProjectDiffTextFile): FileContents {
  return {
    name: file.path,
    contents: file.contents,
    cacheKey: `howcode:${projectId}:${file.path}:${file.revision}`,
  }
}

export function hydrateDiffForEditing(fileDiff: FileDiffMetadata, files: FileDiffLoadedFiles) {
  if (fileDiff.isPartial && fileDiff.type !== 'new') {
    hydratePartialDiff('merge', fileDiff, files)
  }
}

export function useDiffFileContent({
  projectId,
  resolvedBaseline,
}: {
  projectId: string
  resolvedBaseline: ProjectDiffResolvedBaseline | null
}) {
  const scopeKey = `${projectId}:${resolvedBaseline?.rev ?? ''}`
  const [failure, setFailure] = useState<{ scopeKey: string; message: string } | null>(null)

  const loadContent = useCallback(
    async (fileDiff: FileDiffMetadata) => {
      if (!resolvedBaseline) {
        const message = 'Could not expand this file before the diff baseline resolved.'
        setFailure({ scopeKey, message })
        throw new Error(message)
      }

      try {
        const newPath = resolveFileDiffPath(fileDiff)
        const oldPath =
          fileDiff.type === 'new' || fileDiff.type === 'rename-pure'
            ? null
            : resolveDiffFilePath(fileDiff.prevName ?? fileDiff.name)
        const result = await getProjectDiffFileContentsQuery({
          projectId,
          baselineRevision: resolvedBaseline.rev,
          oldPath,
          newPath,
        })
        if (!result) throw new Error('The desktop file-content bridge is unavailable.')
        if (result.kind === 'unavailable') throw new Error(describeIssue(result.issue))

        setFailure(null)
        return result
      } catch (error) {
        const message = getErrorMessage(error, 'Could not expand this file.')
        setFailure({ scopeKey, message })
        throw new Error(message)
      }
    },
    [projectId, resolvedBaseline, scopeKey],
  )

  const loadFiles = useCallback<FileDiffContentsLoader>(
    async (fileDiff): Promise<FileDiffLoadedFiles> => {
      const result = await loadContent(fileDiff)
      return {
        oldFile: result.oldFile ? toPierreFile(projectId, result.oldFile) : null,
        newFile: toPierreFile(projectId, result.newFile),
      }
    },
    [loadContent, projectId],
  )

  const prepareWrite = useCallback(
    async (fileDiff: FileDiffMetadata) => {
      if (fileDiff.type === 'deleted') throw new Error('Deleted files cannot be edited.')
      const result = await loadContent(fileDiff)
      const files = {
        oldFile: result.oldFile ? toPierreFile(projectId, result.oldFile) : null,
        newFile: toPierreFile(projectId, result.newFile),
      }
      hydrateDiffForEditing(fileDiff, files)
      return { path: result.newFile.path, revision: result.newFile.revision }
    },
    [loadContent, projectId],
  )

  const controller = useMemo(
    () => ({ loadFiles, prepareWrite }) satisfies DiffFileContentController,
    [loadFiles, prepareWrite],
  )

  return {
    controller,
    error: failure?.scopeKey === scopeKey ? failure.message : null,
  }
}
