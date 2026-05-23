const trailingSlashPattern = /\/+$/

import type { CodeViewHandle, DiffLineAnnotation } from '@pierre/diffs/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import { getFeatureStatusDataAttributes } from '../../../features/feature-status'
import { useDesktopDiff } from '../../../hooks/useDesktopDiff'
import { diffPanelMainSurfaceClass, diffPanelSplitSurfaceClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { DiffCommentAnnotationCard } from './diff-comment-annotation-card'
import {
  buildFileDiffRenderKey,
  type DiffCommentMetadata,
  isImageDiffFile,
  resolveFileDiffPath,
} from './diff-panel-content.helpers'
import { DiffPanelContentBody } from './diff-panel-content-body'
import { useDiffCommentDrafting } from './useDiffCommentDrafting'
import { useDiffPanelCommentState } from './useDiffPanelCommentState'
import { useDiffPanelScrollAlignment } from './useDiffPanelScrollAlignment'
import { useWorkerRenderablePatch } from './useWorkerRenderablePatch'

type DiffPanelContentProps = {
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
}

export function DiffPanelContent({
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
}: DiffPanelContentProps) {
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({})
  const [focusedFilePaths, setFocusedFilePaths] = useState<readonly string[]>([])
  const [renderFileTree, setRenderFileTree] = useState(showFileTree)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const codeViewRef = useRef<CodeViewHandle<DiffCommentMetadata> | null>(null)
  const draftCardRef = useRef<HTMLDivElement | null>(null)
  const { diff, streamedPatch, isLoading, error } = useDesktopDiff(
    projectId,
    baseline,
    isGitRepo,
    includeUntracked,
  )

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

  const {
    commentAnnotationsByFile,
    draftComment,
    draftSelectedLines,
    draftTarget,
    hasCommentContext,
    persistDraftComment,
    removeComment,
    savedComments,
    setDraftComment,
  } = useDiffPanelCommentState({ baseline, includeUntracked, projectId })

  const {
    clearDragSelection,
    getFileInteractionHandlers,
    getSelectedLinesForFile,
    handleFilePointerDownCapture,
    openDraftComment,
  } = useDiffCommentDrafting({
    draftComment,
    setDraftComment,
  })

  useEffect(() => {
    if (showFileTree) {
      setRenderFileTree(true)
      return
    }

    setFocusedFilePaths([])
    const timeout = window.setTimeout(() => setRenderFileTree(false), 200)
    return () => window.clearTimeout(timeout)
  }, [showFileTree])

  useEffect(() => {
    if (!hasCommentContext) {
      clearDragSelection()
    }
  }, [clearDragSelection, hasCommentContext])

  const toggleFileCollapsed = useCallback(
    (fileKey: string) => {
      setCollapsedFiles((current) => ({
        ...current,
        [fileKey]: !(current[fileKey] ?? imageFileKeys.has(fileKey)),
      }))
    },
    [imageFileKeys],
  )

  const renderCommentAnnotation = (annotation: DiffLineAnnotation<DiffCommentMetadata>) => (
    <DiffCommentAnnotationCard
      annotation={annotation}
      draftCardRef={draftCardRef}
      draftComment={draftComment}
      setDraftComment={setDraftComment}
      onPersistDraftComment={persistDraftComment}
      onRemoveComment={removeComment}
    />
  )

  useDiffPanelScrollAlignment({
    collapsedFiles,
    draftCardRef,
    draftTarget,
    codeViewRef,
    renderableFiles: visibleRenderableFiles,
    savedComments,
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
        baseline={baseline}
        codeViewRef={codeViewRef}
        collapsedFiles={collapsedFiles}
        commentAnnotationsByFile={
          commentAnnotationsByFile as Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>
        }
        diff={diff}
        diffRenderMode={diffRenderMode}
        draftSelectedLines={draftSelectedLines}
        error={error}
        focusedImageFileKeys={focusedImageFileKeys}
        focusedFilePaths={focusedFilePaths}
        getFileInteractionHandlers={getFileInteractionHandlers}
        getSelectedLinesForFile={getSelectedLinesForFile}
        handleFilePointerDownCapture={handleFilePointerDownCapture}
        hasFocusedFiles={hasFocusedFiles}
        hasNoNetChanges={hasNoNetChanges}
        hasResolvedPatch={hasResolvedPatch}
        isGitRepo={isGitRepo}
        isLoading={isLoading}
        loading={loading}
        openDraftComment={openDraftComment}
        projectId={projectId}
        renderCommentAnnotation={renderCommentAnnotation}
        renderableFiles={renderableFiles}
        renderablePatch={renderablePatch}
        renderFileTree={renderFileTree}
        scrollContainerRef={scrollContainerRef}
        setFocusedFilePaths={setFocusedFilePaths}
        showFileTree={showFileTree}
        toggleFileCollapsed={toggleFileCollapsed}
        visibleRenderableFiles={visibleRenderableFiles}
      />
    </aside>
  )
}
