const trailingSlashPattern = /\/+$/

import type { CodeViewHandle } from '@pierre/diffs/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import { getFeatureStatusDataAttributes } from '../../../features/feature-status'
import { useDesktopDiff } from '../../../hooks/useDesktopDiff'
import { diffPanelMainSurfaceClass, diffPanelSplitSurfaceClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import type { GitOpsFileActions } from '../edit/gitops-file-actions'
import { useDiffEditing } from '../edit/use-diff-editing'
import type { GitOpsAnnotationMetadata } from '../review/pierre-review-adapter'
import { useDiffReviewState } from '../review/use-diff-review-state'
import { useReviewCodeViewController } from '../review/use-review-code-view-controller'
import {
  buildFileDiffRenderKey,
  isImageDiffFile,
  resolveFileDiffPath,
} from './diff-panel-content.helpers'
import { DiffPanelContentBody } from './diff-panel-content-body'
import { useDiffFileContent } from './use-diff-file-content'
import { useDiffPanelScrollAlignment } from './useDiffPanelScrollAlignment'
import { useWorkerRenderablePatch } from './useWorkerRenderablePatch'

type DiffPanelContentProps = {
  fileActions: GitOpsFileActions
  projectId: string
  isGitRepo: boolean
  baseline: ProjectDiffBaseline | null
  selectedFilePath: string | null
  selectedCommentId: string | null
  selectedCommentJumpKey: number
  diffRenderMode: 'stacked' | 'split'
  layoutMode?: 'split' | 'overlay' | 'main'
  showFileTree?: boolean
  includeUntracked?: boolean
  loading?: boolean
  onLoadErrorChange?: ((error: string | null) => void) | undefined
}

export function DiffPanelContent({
  fileActions,
  projectId,
  isGitRepo,
  baseline,
  selectedFilePath,
  selectedCommentId,
  selectedCommentJumpKey,
  diffRenderMode,
  layoutMode = 'split',
  showFileTree = true,
  includeUntracked = false,
  loading = false,
  onLoadErrorChange,
}: DiffPanelContentProps) {
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({})
  const [focusedFilePaths, setFocusedFilePaths] = useState<readonly string[]>([])
  const [renderFileTree, setRenderFileTree] = useState(showFileTree)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const codeViewRef = useRef<CodeViewHandle<GitOpsAnnotationMetadata> | null>(null)
  const draftCardRef = useRef<HTMLDivElement | null>(null)
  const { diff, streamedPatch, isLoading, error } = useDesktopDiff(
    projectId,
    baseline,
    isGitRepo,
    includeUntracked,
  )
  const fileContent = useDiffFileContent({
    projectId,
    resolvedBaseline: diff?.resolvedBaseline ?? null,
  })
  const reviewState = useDiffReviewState({ baseline, includeUntracked, projectId })
  const editing = useDiffEditing({
    fileActions,
    fileContent: fileContent.controller,
    onAnnotationsChange: reviewState.reanchorAnnotations,
    projectId,
  })
  const editingError =
    editing.state.kind === 'idle' || editing.state.kind === 'editing' ? editing.state.error : null
  const loadError = error ?? fileContent.error ?? editingError

  useEffect(() => {
    onLoadErrorChange?.(loadError)
  }, [loadError, onLoadErrorChange])

  useEffect(() => {
    return () => onLoadErrorChange?.(null)
  }, [onLoadErrorChange])

  const selectedPatch = streamedPatch ?? diff?.diff ?? undefined
  const hasResolvedPatch = typeof selectedPatch === 'string'
  const hasNoNetChanges = !isLoading && hasResolvedPatch && selectedPatch.trim().length === 0
  const renderablePatch = useWorkerRenderablePatch(selectedPatch, !isLoading)
  const renderableFiles = useMemo(
    () => (renderablePatch && renderablePatch.kind === 'files' ? renderablePatch.files : []),
    [renderablePatch],
  )

  const normalizedFocusedFilePaths = useMemo(
    () => focusedFilePaths.map((filePath) => filePath.replace(trailingSlashPattern, '')),
    [focusedFilePaths],
  )
  const selectedFilePathSet = useMemo(
    () => new Set(normalizedFocusedFilePaths),
    [normalizedFocusedFilePaths],
  )
  const hasFocusedFiles = showFileTree && normalizedFocusedFilePaths.length > 0
  const imageFileKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const fileDiff of renderableFiles) {
      if (isImageDiffFile(fileDiff)) {
        keys.add(buildFileDiffRenderKey(fileDiff))
      }
    }
    return keys
  }, [renderableFiles])
  const focusedImageFileKeys = useMemo(() => {
    if (normalizedFocusedFilePaths.length !== 1) return new Set<string>()
    const selectedPath = normalizedFocusedFilePaths[0]
    const selectedImage = renderableFiles.find(
      (fileDiff) => resolveFileDiffPath(fileDiff) === selectedPath && isImageDiffFile(fileDiff),
    )
    return selectedImage ? new Set([buildFileDiffRenderKey(selectedImage)]) : new Set<string>()
  }, [normalizedFocusedFilePaths, renderableFiles])
  const visibleRenderableFiles = useMemo(() => {
    if (!hasFocusedFiles) {
      return renderableFiles
    }

    const isVisiblePath = (filePath: string) =>
      selectedFilePathSet.has(filePath) ||
      normalizedFocusedFilePaths.some((selectedPath) => filePath.startsWith(`${selectedPath}/`))
    const selectedFileStillVisible = selectedFilePath ? isVisiblePath(selectedFilePath) : true

    return renderableFiles.filter((fileDiff) => {
      const filePath = resolveFileDiffPath(fileDiff)
      return isVisiblePath(filePath) || (!selectedFileStillVisible && filePath === selectedFilePath)
    })
  }, [
    hasFocusedFiles,
    normalizedFocusedFilePaths,
    renderableFiles,
    selectedFilePath,
    selectedFilePathSet,
  ])

  useEffect(() => {
    if (showFileTree) {
      setRenderFileTree(true)
      return
    }

    setFocusedFilePaths([])
    const timeout = window.setTimeout(() => setRenderFileTree(false), 200)
    return () => window.clearTimeout(timeout)
  }, [showFileTree])

  const toggleFileCollapsed = useCallback(
    (fileKey: string) => {
      setCollapsedFiles((current) => ({
        ...current,
        [fileKey]: !(current[fileKey] ?? imageFileKeys.has(fileKey)),
      }))
    },
    [imageFileKeys],
  )

  const codeViewReview = useReviewCodeViewController({ draftCardRef, review: reviewState })

  useDiffPanelScrollAlignment({
    collapsedFiles,
    draftCardRef,
    draftTarget: reviewState.draft.comment?.target ?? null,
    codeViewRef,
    renderableFiles: visibleRenderableFiles,
    savedComments: reviewState.comments.items,
    scrollContainerRef,
    selectedCommentId,
    selectedCommentJumpKey,
    selectedFilePath,
    setCollapsedFiles,
  })

  return (
    <aside
      className={cn(
        layoutMode === 'split' ? diffPanelSplitSurfaceClass : diffPanelMainSurfaceClass,
      )}
      {...getFeatureStatusDataAttributes('feature:diff.panel')}
    >
      <DiffPanelContentBody
        projectId={projectId}
        diff={{
          baseline,
          error: loadError,
          hasNoNetChanges,
          hasResolvedPatch,
          isGitRepo,
          isLoading,
          loading,
          renderablePatch,
          result: diff,
        }}
        files={{
          all: renderableFiles,
          collapsed: collapsedFiles,
          focusedImageKeys: focusedImageFileKeys,
          toggleCollapsed: toggleFileCollapsed,
          visible: visibleRenderableFiles,
        }}
        fileTree={{
          focusedPaths: focusedFilePaths,
          hasFocusedFiles,
          render: renderFileTree,
          setFocusedPaths: setFocusedFilePaths,
          show: showFileTree,
        }}
        codeView={{
          ref: codeViewRef,
          fileContent: fileContent.controller,
          editing,
          renderMode: diffRenderMode,
          review: codeViewReview,
          scrollContainerRef,
        }}
      />
    </aside>
  )
}
