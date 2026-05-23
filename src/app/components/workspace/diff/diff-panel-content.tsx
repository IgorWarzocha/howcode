const trailingSlashPattern = /\/+$/

import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import { getFeatureStatusDataAttributes } from '../../../features/feature-status'
import { useDesktopDiff } from '../../../hooks/useDesktopDiff'
import { diffPanelMainSurfaceClass, diffPanelSplitSurfaceClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { DiffCommentAnnotationCard } from './diff-comment-annotation-card'
import {
  buildFileDiffRenderKey,
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  type DiffCommentMetadata,
  estimateFileDiffHeight,
  orderRenderableFiles,
  resolveFileDiffPath,
} from './diff-panel-content.helpers'
import { DiffPanelContentBody } from './diff-panel-content-body'
import { useDeferredDiffContentReady } from './useDeferredDiffContentReady'
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
  loading = false,
}: DiffPanelContentProps) {
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({})
  const [focusedFilePaths, setFocusedFilePaths] = useState<readonly string[]>([])
  const [renderFileTree, setRenderFileTree] = useState(showFileTree)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const draftCardRef = useRef<HTMLDivElement | null>(null)
  const { diff, isLoading, error } = useDesktopDiff(projectId, baseline, isGitRepo)

  const selectedPatch = diff?.diff
  const hasResolvedPatch = typeof selectedPatch === 'string'
  const hasNoNetChanges = hasResolvedPatch && selectedPatch.trim().length === 0
  const renderablePatch = useWorkerRenderablePatch(selectedPatch)
  const renderableFiles = useMemo(
    () =>
      renderablePatch && renderablePatch.kind === 'files'
        ? orderRenderableFiles(renderablePatch.files)
        : [],
    [renderablePatch],
  )

  const diffContentReady = useDeferredDiffContentReady(renderablePatch)
  const normalizedFocusedFilePaths = useMemo(
    () => focusedFilePaths.map((filePath) => filePath.replace(trailingSlashPattern, '')),
    [focusedFilePaths],
  )
  const selectedFilePathSet = useMemo(
    () => new Set(normalizedFocusedFilePaths),
    [normalizedFocusedFilePaths],
  )
  const hasFocusedFiles = showFileTree && normalizedFocusedFilePaths.length > 0
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
    annotationCountByFile,
    commentAnnotationsByFile,
    draftComment,
    draftSelectedLines,
    draftTarget,
    hasCommentContext,
    persistDraftComment,
    removeComment,
    savedComments,
    setDraftComment,
  } = useDiffPanelCommentState({ projectId })

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

  const estimatedFileHeights = useMemo(
    () =>
      visibleRenderableFiles.map((fileDiff) => {
        const fileKey = buildFileDiffRenderKey(fileDiff)
        return estimateFileDiffHeight({
          fileDiff,
          collapsed: collapsedFiles[fileKey] === true,
          diffRenderMode,
          annotationCount: annotationCountByFile.get(fileKey) ?? 0,
        })
      }),
    [annotationCountByFile, collapsedFiles, diffRenderMode, visibleRenderableFiles],
  )

  const getVirtualItemKey = useCallback(
    (index: number) => buildFileDiffRenderKey(visibleRenderableFiles[index] as FileDiffMetadata),
    [visibleRenderableFiles],
  )

  const fileListVirtualizer = useVirtualizer({
    count: visibleRenderableFiles.length,
    getScrollElement: () => scrollContainerRef.current,
    initialRect: {
      width: 960,
      height: 720,
    },
    estimateSize: (index) =>
      estimatedFileHeights[index] ??
      DIFF_FILE_ESTIMATED_HEADER_HEIGHT + DIFF_FILE_ESTIMATED_FILE_GAP,
    getItemKey: getVirtualItemKey,
    overscan: 3,
    useAnimationFrameWithResizeObserver: true,
  })

  const toggleFileCollapsed = useCallback((fileKey: string) => {
    setCollapsedFiles((current) => ({
      ...current,
      [fileKey]: !current[fileKey],
    }))
  }, [])

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
    fileListVirtualizer,
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
        collapsedFiles={collapsedFiles}
        commentAnnotationsByFile={
          commentAnnotationsByFile as Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>
        }
        diff={diff}
        diffContentReady={diffContentReady}
        diffRenderMode={diffRenderMode}
        draftSelectedLines={draftSelectedLines}
        error={error}
        fileListVirtualizer={fileListVirtualizer}
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
