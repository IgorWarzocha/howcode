const trailingSlashPattern = /\/+$/

import type { SelectedLineRange } from '@pierre/diffs'
import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import { getFeatureStatusDataAttributes } from '../../../features/feature-status'
import { useDesktopDiff } from '../../../hooks/useDesktopDiff'
import { cn } from '../../../utils/cn'
import { getDiffBaselinePrefix, getResolvedDiffBaselineLabel } from '../composer/diff-baseline'
import { DiffChangedFilesTree } from './diff-changed-files-tree'
import { DiffCommentAnnotationCard } from './diff-comment-annotation-card'
import {
  buildFileDiffRenderKey,
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  type DiffCommentMetadata,
  estimateFileDiffHeight,
  getRenderablePatch,
  orderRenderableFiles,
  resolveFileDiffPath,
} from './diff-panel-content.helpers'
import { DiffPanelEmptyState } from './diff-panel-empty-state'
import { DiffPanelFileList } from './diff-panel-file-list'
import { DiffPanelSkeleton } from './diff-panel-skeleton'
import { useDiffCommentDrafting } from './useDiffCommentDrafting'
import { useDiffPanelCommentState } from './useDiffPanelCommentState'
import { useDiffPanelScrollAlignment } from './useDiffPanelScrollAlignment'

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

function DiffPanelUnavailable({
  baseline,
  diff,
  error,
  hasNoNetChanges,
}: {
  baseline: ProjectDiffBaseline | null
  diff: ReturnType<typeof useDesktopDiff>['diff']
  error: string | null
  hasNoNetChanges: boolean
}) {
  return (
    <div className="flex h-full items-center justify-center px-3 py-2 text-center text-xs text-[color:var(--muted)]">
      <div className="grid max-w-[42rem] gap-1.5">
        <p>
          {error
            ? 'Diff unavailable.'
            : hasNoNetChanges
              ? `No net changes ${getDiffBaselinePrefix(baseline)} ${getResolvedDiffBaselineLabel(baseline, diff?.resolvedBaseline)}.`
              : 'No patch available for this worktree.'}
        </p>
        {error ? <p className="text-[color:var(--danger)]">{error}</p> : null}
      </div>
    </div>
  )
}

function RawPatchView({ reason, text }: { reason: string; text: string }) {
  return (
    <div className="h-full overflow-auto p-3">
      <div className="space-y-2">
        <p className="text-[11px] text-[color:var(--muted)]">{reason}</p>
        <pre className="max-h-[70vh] overflow-auto rounded-xl border border-[color:var(--border)] bg-[rgba(18,20,28,0.7)] p-3 font-mono text-[11px] leading-relaxed text-[color:var(--text)]/90">
          {text}
        </pre>
      </div>
    </div>
  )
}

function DiffFilesView(input: {
  collapsedFiles: Record<string, boolean>
  commentAnnotationsByFile: Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>
  diffContentReady: boolean
  diffRenderMode: 'stacked' | 'split'
  draftSelectedLines: SelectedLineRange | null
  fileListVirtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>
  focusedFilePaths: readonly string[]
  getFileInteractionHandlers: ReturnType<
    typeof useDiffCommentDrafting
  >['getFileInteractionHandlers']
  getSelectedLinesForFile: ReturnType<typeof useDiffCommentDrafting>['getSelectedLinesForFile']
  handleFilePointerDownCapture: ReturnType<
    typeof useDiffCommentDrafting
  >['handleFilePointerDownCapture']
  hasFocusedFiles: boolean
  openDraftComment: ReturnType<typeof useDiffCommentDrafting>['openDraftComment']
  projectId: string
  renderCommentAnnotation: (annotation: DiffLineAnnotation<DiffCommentMetadata>) => React.ReactNode
  renderableFiles: FileDiffMetadata[]
  renderFileTree: boolean
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  setFocusedFilePaths: (paths: readonly string[]) => void
  showFileTree: boolean
  toggleFileCollapsed: (fileKey: string) => void
  visibleRenderableFiles: FileDiffMetadata[]
}) {
  return (
    <div className="relative h-full min-h-0">
      {input.diffContentReady ? null : (
        <div className="absolute inset-0 z-10 bg-[color:var(--workspace)]">
          <DiffPanelSkeleton showFileTree={input.showFileTree} />
        </div>
      )}
      <div
        className={cn(
          'flex h-full min-h-0 transition-opacity duration-100',
          input.diffContentReady ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div
          ref={input.scrollContainerRef}
          className="min-h-0 min-w-0 flex-1 overflow-auto [overflow-anchor:none]"
        >
          <DiffPanelFileList
            collapsedFiles={input.collapsedFiles}
            commentAnnotationsByFile={input.commentAnnotationsByFile}
            diffRenderMode={input.diffRenderMode}
            draftSelectedLines={input.draftSelectedLines}
            getFileInteractionHandlers={input.getFileInteractionHandlers}
            getSelectedLinesForFile={input.getSelectedLinesForFile}
            handleFilePointerDownCapture={input.handleFilePointerDownCapture}
            measureElement={input.fileListVirtualizer.measureElement}
            onOpenDraftComment={input.openDraftComment}
            onToggleFileCollapsed={input.toggleFileCollapsed}
            projectId={input.projectId}
            renderCommentAnnotation={input.renderCommentAnnotation}
            renderableFiles={input.visibleRenderableFiles}
            totalSize={input.fileListVirtualizer.getTotalSize()}
            virtualItems={input.fileListVirtualizer.getVirtualItems()}
          />
        </div>
        <div
          className="min-h-0 shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out"
          style={{
            width: input.showFileTree ? 'min(28rem, calc(100% - 2.5rem))' : 0,
            opacity: input.showFileTree ? 1 : 0,
          }}
          aria-hidden={!input.showFileTree}
        >
          {input.renderFileTree ? (
            <DiffChangedFilesTree
              files={input.renderableFiles}
              selectedPaths={input.focusedFilePaths}
              focusedFileCount={input.hasFocusedFiles ? input.visibleRenderableFiles.length : 0}
              onSelectedPathsChange={input.setFocusedFilePaths}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DiffPanelContentBody(input: {
  baseline: ProjectDiffBaseline | null
  collapsedFiles: Record<string, boolean>
  commentAnnotationsByFile: Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>
  diff: ReturnType<typeof useDesktopDiff>['diff']
  diffContentReady: boolean
  diffRenderMode: 'stacked' | 'split'
  draftSelectedLines: SelectedLineRange | null
  error: string | null
  fileListVirtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>
  focusedFilePaths: readonly string[]
  getFileInteractionHandlers: ReturnType<
    typeof useDiffCommentDrafting
  >['getFileInteractionHandlers']
  getSelectedLinesForFile: ReturnType<typeof useDiffCommentDrafting>['getSelectedLinesForFile']
  handleFilePointerDownCapture: ReturnType<
    typeof useDiffCommentDrafting
  >['handleFilePointerDownCapture']
  hasFocusedFiles: boolean
  hasNoNetChanges: boolean
  isGitRepo: boolean
  isLoading: boolean
  loading: boolean
  openDraftComment: ReturnType<typeof useDiffCommentDrafting>['openDraftComment']
  projectId: string
  renderCommentAnnotation: (annotation: DiffLineAnnotation<DiffCommentMetadata>) => React.ReactNode
  renderableFiles: FileDiffMetadata[]
  renderablePatch: ReturnType<typeof getRenderablePatch>
  renderFileTree: boolean
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  setFocusedFilePaths: (paths: readonly string[]) => void
  showFileTree: boolean
  toggleFileCollapsed: (fileKey: string) => void
  visibleRenderableFiles: FileDiffMetadata[]
}) {
  if (input.loading)
    return (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <DiffPanelSkeleton showFileTree={input.showFileTree} />
      </div>
    )
  if (!input.isGitRepo)
    return (
      <DiffPanelEmptyState message="Diffs are unavailable because this project is not a git repository." />
    )
  if (input.isLoading && !input.renderablePatch)
    return (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <DiffPanelSkeleton showFileTree={input.showFileTree} />
      </div>
    )
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
      {input.renderablePatch?.kind === 'files' ? (
        <DiffFilesView {...input} />
      ) : input.renderablePatch ? (
        <RawPatchView reason={input.renderablePatch.reason} text={input.renderablePatch.text} />
      ) : (
        <DiffPanelUnavailable
          baseline={input.baseline}
          diff={input.diff}
          error={input.error}
          hasNoNetChanges={input.hasNoNetChanges}
        />
      )}
    </div>
  )
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
  const [diffContentReady, setDiffContentReady] = useState(false)
  const [focusedFilePaths, setFocusedFilePaths] = useState<readonly string[]>([])
  const [renderFileTree, setRenderFileTree] = useState(showFileTree)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const draftCardRef = useRef<HTMLDivElement | null>(null)
  const { diff, isLoading, error } = useDesktopDiff(projectId, baseline, isGitRepo)

  const selectedPatch = diff?.diff
  const hasResolvedPatch = typeof selectedPatch === 'string'
  const hasNoNetChanges = hasResolvedPatch && selectedPatch.trim().length === 0
  const renderablePatch = useMemo(
    () => getRenderablePatch(selectedPatch, 'diff-panel:dark'),
    [selectedPatch],
  )
  const renderableFiles = useMemo(
    () =>
      renderablePatch && renderablePatch.kind === 'files'
        ? orderRenderableFiles(renderablePatch.files)
        : [],
    [renderablePatch],
  )

  useEffect(() => {
    if (!renderablePatch || renderablePatch.kind !== 'files') {
      setDiffContentReady(false)
      return
    }

    setDiffContentReady(false)
    const timeout = window.setTimeout(() => setDiffContentReady(true), 120)
    return () => window.clearTimeout(timeout)
  }, [renderablePatch])
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
        'flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] bg-[color:var(--workspace)]',
        layoutMode === 'split' && 'border-l border-[color:var(--border)] xl:w-full',
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
