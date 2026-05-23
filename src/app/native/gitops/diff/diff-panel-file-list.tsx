const gitDiffPrefixPattern = /^[ab]\//

import type {
  CodeViewItem,
  CodeViewOptions,
  GetHoveredLineResult,
  SelectedLineRange,
} from '@pierre/diffs'
import {
  type AnnotationSide,
  CodeView,
  type CodeViewHandle,
  type DiffLineAnnotation,
  type FileDiffMetadata,
} from '@pierre/diffs/react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, MessageSquarePlus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from '../../../common/tooltip'
import type { ProjectDiffBaseline, ProjectDiffImageSide } from '../../../desktop/types'
import { getProjectDiffImagePreviewQuery } from '../../../query/desktop-query'
import { desktopQueryKeys } from '../../../query/desktop-query-keys'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTitleClass,
  appTypeMetaStrongClass,
  appTypeSmallClass,
  diffCommentGutterButtonClass,
  diffFileHeaderButtonClass,
  diffFileShellClass,
  diffImagePreviewClass,
  diffImagePreviewFrameClass,
  diffImagePreviewPanelClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import {
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  DIFF_FILE_ESTIMATED_LINE_HEIGHT,
  DIFF_PANEL_UNSAFE_CSS,
  type DiffCommentMetadata,
  getFileChangeCounts,
  getFileHeaderContextLabel,
  isImageDiffFile,
} from './diff-panel-content.helpers'
import { resolveDiffThemeName } from './diff-rendering'

type FileInteractionHandlers = {
  onLineClick: ({
    lineNumber,
    annotationSide,
    event,
  }: {
    lineNumber: number
    annotationSide: AnnotationSide
    event: PointerEvent
  }) => void
  onLineNumberClick: ({
    lineNumber,
    annotationSide,
    event,
  }: {
    lineNumber: number
    annotationSide: AnnotationSide
    event: PointerEvent
  }) => void
}

type DiffPanelFileListProps = {
  baseline: ProjectDiffBaseline | null
  codeViewRef: React.RefObject<CodeViewHandle<DiffCommentMetadata> | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  collapsedFiles: Record<string, boolean>
  commentAnnotationsByFile: Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>
  diffRenderMode: 'stacked' | 'split'
  focusedImageFileKeys: ReadonlySet<string>
  getFileInteractionHandlers: (fileKey: string, filePath: string) => FileInteractionHandlers
  getSelectedLinesForFile: (
    fileKey: string,
    draftSelectedLines: SelectedLineRange | null,
  ) => SelectedLineRange | null
  onFilePointerDownCapture: (
    event: React.PointerEvent<HTMLDivElement>,
    fileKey: string,
    filePath: string,
  ) => void
  onOpenDraftComment: (
    fileKey: string,
    filePath: string,
    side: AnnotationSide,
    lineNumber: number,
  ) => void
  onToggleFileCollapsed: (fileKey: string) => void
  projectId: string
  renderCommentAnnotation: (annotation: DiffLineAnnotation<DiffCommentMetadata>) => React.ReactNode
  renderableFiles: FileDiffMetadata[]
  draftSelectedLines: SelectedLineRange | null
}

type DiffItem = CodeViewItem<DiffCommentMetadata> & { type: 'diff' }

function DiffImagePreviewPane({
  baseline,
  filePath,
  projectId,
  side,
}: {
  baseline: ProjectDiffBaseline | null
  filePath: string
  projectId: string
  side: ProjectDiffImageSide
}) {
  const previewQuery = useQuery({
    queryKey: desktopQueryKeys.projectDiffImagePreview(projectId, filePath, side, baseline),
    queryFn: () => getProjectDiffImagePreviewQuery({ projectId, baseline, path: filePath, side }),
  })
  const label = side === 'old' ? 'Before' : 'After'

  return (
    <div className={diffImagePreviewPanelClass}>
      <div className={cn(appTypeMetaStrongClass, appToneMutedClass)}>{label}</div>
      <div className={diffImagePreviewFrameClass}>
        {previewQuery.data?.dataUrl ? (
          <img
            src={previewQuery.data.dataUrl}
            alt={`${label} preview for ${filePath}`}
            className="max-h-[58vh] max-w-full object-contain"
          />
        ) : (
          <div className={cn(appTypeSmallClass, appToneMutedClass)}>
            {previewQuery.isLoading ? 'Loading image…' : 'No image preview'}
          </div>
        )}
      </div>
    </div>
  )
}

function DiffImagePreview({
  baseline,
  fileDiff,
  projectId,
}: {
  baseline: ProjectDiffBaseline | null
  fileDiff: FileDiffMetadata
  projectId: string
}) {
  const sides: ProjectDiffImageSide[] =
    fileDiff.type === 'new' ? ['new'] : fileDiff.type === 'deleted' ? ['old'] : ['old', 'new']
  const getSideFilePath = (side: ProjectDiffImageSide) => {
    const rawPath = side === 'old' ? (fileDiff.prevName ?? fileDiff.name) : fileDiff.name
    return rawPath?.replace(gitDiffPrefixPattern, '') ?? ''
  }

  return (
    <div className={cn(diffImagePreviewClass, sides.length === 1 && 'md:grid-cols-1')}>
      {sides.map((side) => {
        const sideFilePath = getSideFilePath(side)
        return (
          <DiffImagePreviewPane
            key={side}
            baseline={baseline}
            filePath={sideFilePath}
            projectId={projectId}
            side={side}
          />
        )
      })}
    </div>
  )
}

function getDiffFileIdentity(fileDiff: FileDiffMetadata) {
  const filePath = fileDiff.name?.replace(gitDiffPrefixPattern, '') ?? fileDiff.prevName ?? ''
  const fileKey = `${fileDiff.prevName ?? 'none'}:${fileDiff.name}`
  return { fileKey, filePath }
}

function DiffPanelFileHeader({
  fileDiff,
  fileKey,
  filePath,
  isCollapsed,
  onToggleFileCollapsed,
}: {
  fileDiff: FileDiffMetadata
  fileKey: string
  filePath: string
  isCollapsed: boolean
  onToggleFileCollapsed: (fileKey: string) => void
}) {
  const headerContextLabel = getFileHeaderContextLabel(fileDiff)
  const { additions, deletions } = getFileChangeCounts(fileDiff)
  return (
    <button
      type="button"
      className={diffFileHeaderButtonClass}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggleFileCollapsed(fileKey)
      }}
      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${filePath}`}
      aria-expanded={!isCollapsed}
      data-diff-file-path={filePath}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[color:var(--muted)]">
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <span className={cn('truncate', appTypeGroupTitleClass, appToneTextClass)}>{filePath}</span>
        {headerContextLabel ? (
          <span className={cn('shrink-0', appTypeSmallClass, appToneMutedClass)}>
            {headerContextLabel}
          </span>
        ) : null}
      </span>
      <span className={cn('flex shrink-0 items-center gap-2', appTypeSmallClass)}>
        {deletions > 0 || additions === 0 ? (
          <span className="text-[color:var(--danger)]">-{deletions}</span>
        ) : null}
        {additions > 0 || deletions === 0 ? (
          <span className="text-[color:var(--green)]">+{additions}</span>
        ) : null}
      </span>
    </button>
  )
}

function getItemFileDiff(item: CodeViewItem<DiffCommentMetadata>) {
  return item.type === 'diff' ? item.fileDiff : null
}

function getCodeViewItemSyncState(items: DiffItem[]) {
  return {
    ids: items.map((item) => item.id),
    versions: new Map(items.map((item) => [item.id, item.version])),
  }
}

function hashString(input: string) {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index)
  }
  return hash >>> 0
}

function getAnnotationVersionKey(annotations: readonly DiffLineAnnotation<DiffCommentMetadata>[]) {
  return annotations
    .map(
      (annotation) =>
        `${annotation.metadata.id}:${annotation.metadata.kind}:${annotation.side}:${annotation.lineNumber}:${annotation.metadata.body.length}`,
    )
    .join('|')
}

function isAppendOnlyItemList(previousIds: string[], nextIds: string[]) {
  return (
    previousIds.length <= nextIds.length &&
    previousIds.every((previousId, index) => previousId === nextIds[index])
  )
}

function syncAppendOnlyCodeViewItems({
  handle,
  items,
  previous,
}: {
  handle: CodeViewHandle<DiffCommentMetadata>
  items: DiffItem[]
  previous: { ids: string[]; versions: Map<string, number | undefined> }
}) {
  for (const item of items.slice(0, previous.ids.length)) {
    if (previous.versions.get(item.id) !== item.version) {
      handle.updateItem(item)
    }
  }
  const appendedItems = items.slice(previous.ids.length)
  if (appendedItems.length > 0) handle.addItems(appendedItems)
}

export function DiffPanelFileList({
  baseline,
  codeViewRef,
  scrollContainerRef,
  collapsedFiles,
  commentAnnotationsByFile,
  diffRenderMode,
  draftSelectedLines,
  focusedImageFileKeys,
  getFileInteractionHandlers,
  getSelectedLinesForFile,
  onFilePointerDownCapture,
  onOpenDraftComment,
  onToggleFileCollapsed,
  projectId,
  renderCommentAnnotation,
  renderableFiles,
}: DiffPanelFileListProps) {
  const items = useMemo<DiffItem[]>(
    () =>
      renderableFiles.map((fileDiff) => {
        const { fileKey } = getDiffFileIdentity(fileDiff)
        const isImageFile = isImageDiffFile(fileDiff)
        const annotations = commentAnnotationsByFile.get(fileKey) ?? []
        const collapsed = focusedImageFileKeys.has(fileKey)
          ? false
          : (collapsedFiles[fileKey] ?? isImageFile)
        return {
          id: fileKey,
          type: 'diff',
          fileDiff,
          annotations,
          collapsed,
          version: hashString(
            `${fileKey}:${fileDiff.unifiedLineCount}:${fileDiff.splitLineCount}:${getAnnotationVersionKey(annotations)}:${collapsed ? 1 : 0}`,
          ),
        }
      }),
    [collapsedFiles, commentAnnotationsByFile, focusedImageFileKeys, renderableFiles],
  )

  const selectedLines = useMemo(() => {
    for (const fileDiff of renderableFiles) {
      const { fileKey } = getDiffFileIdentity(fileDiff)
      const range = getSelectedLinesForFile(fileKey, draftSelectedLines)
      if (range) return { id: fileKey, range }
    }
    return null
  }, [draftSelectedLines, getSelectedLinesForFile, renderableFiles])
  const [codeViewHandle, setCodeViewHandleState] =
    useState<CodeViewHandle<DiffCommentMetadata> | null>(null)
  const itemSyncStateRef = useRef<{ ids: string[]; versions: Map<string, number | undefined> }>({
    ids: [],
    versions: new Map(),
  })
  const setCodeViewHandle = useCallback(
    (handle: CodeViewHandle<DiffCommentMetadata> | null) => {
      codeViewRef.current = handle
      if (!handle) itemSyncStateRef.current = { ids: [], versions: new Map() }
      setCodeViewHandleState(handle)
    },
    [codeViewRef],
  )

  useEffect(() => {
    const instance = codeViewHandle?.getInstance()
    if (!(codeViewHandle && instance)) return

    const previous = itemSyncStateRef.current
    const next = getCodeViewItemSyncState(items)
    if (isAppendOnlyItemList(previous.ids, next.ids)) {
      syncAppendOnlyCodeViewItems({
        handle: codeViewHandle,
        items,
        previous,
      })
    } else {
      instance.setItems(items)
    }

    itemSyncStateRef.current = next
  }, [codeViewHandle, items])

  const handleLineClick = useCallback<
    NonNullable<CodeViewOptions<DiffCommentMetadata>['onLineClick']>
  >(
    (lineProps, context) => {
      if (!('annotationSide' in lineProps)) return
      const fileDiff = getItemFileDiff(context.item)
      if (!fileDiff) return
      const { fileKey, filePath } = getDiffFileIdentity(fileDiff)
      getFileInteractionHandlers(fileKey, filePath).onLineClick({
        lineNumber: lineProps.lineNumber,
        annotationSide: lineProps.annotationSide,
        event: lineProps.event,
      })
    },
    [getFileInteractionHandlers],
  )

  const handleLineNumberClick = useCallback<
    NonNullable<CodeViewOptions<DiffCommentMetadata>['onLineNumberClick']>
  >(
    (lineProps, context) => {
      if (!('annotationSide' in lineProps)) return
      const fileDiff = getItemFileDiff(context.item)
      if (!fileDiff) return
      const { fileKey, filePath } = getDiffFileIdentity(fileDiff)
      getFileInteractionHandlers(fileKey, filePath).onLineNumberClick({
        lineNumber: lineProps.lineNumber,
        annotationSide: lineProps.annotationSide,
        event: lineProps.event,
      })
    },
    [getFileInteractionHandlers],
  )

  const codeViewOptions = useMemo<CodeViewOptions<DiffCommentMetadata>>(
    () => ({
      diffStyle: diffRenderMode === 'split' ? 'split' : 'unified',
      lineDiffType: 'none',
      overflow: 'wrap',
      theme: resolveDiffThemeName('dark'),
      themeType: 'dark',
      unsafeCSS: DIFF_PANEL_UNSAFE_CSS,
      enableGutterUtility: true,
      lineHoverHighlight: 'both',
      itemMetrics: {
        lineHeight: DIFF_FILE_ESTIMATED_LINE_HEIGHT,
        diffHeaderHeight: DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
        spacing: DIFF_FILE_ESTIMATED_FILE_GAP,
      },
      layout: {
        gap: DIFF_FILE_ESTIMATED_FILE_GAP,
        paddingTop: 0,
        paddingBottom: DIFF_FILE_ESTIMATED_FILE_GAP,
      },
      onLineClick: handleLineClick,
      onLineNumberClick: handleLineNumberClick,
    }),
    [diffRenderMode, handleLineClick, handleLineNumberClick],
  )

  const renderCustomHeader = useCallback(
    (item: CodeViewItem<DiffCommentMetadata>) => {
      const fileDiff = getItemFileDiff(item)
      if (!fileDiff) return null
      const { fileKey, filePath } = getDiffFileIdentity(fileDiff)
      const isCollapsed = item.collapsed === true
      const isImageFile = isImageDiffFile(fileDiff)
      return (
        <div
          className={cn(isImageFile && !isCollapsed && diffFileShellClass)}
          data-diff-file-path={filePath}
          onPointerDownCapture={(event) => onFilePointerDownCapture(event, fileKey, filePath)}
        >
          <DiffPanelFileHeader
            fileDiff={fileDiff}
            fileKey={fileKey}
            filePath={filePath}
            isCollapsed={isCollapsed}
            onToggleFileCollapsed={onToggleFileCollapsed}
          />
          {isImageFile && !isCollapsed ? (
            <DiffImagePreview baseline={baseline} fileDiff={fileDiff} projectId={projectId} />
          ) : null}
        </div>
      )
    },
    [baseline, onFilePointerDownCapture, onToggleFileCollapsed, projectId],
  )

  const renderAnnotation = useCallback(
    (
      annotation: Parameters<
        NonNullable<CodeViewOptions<DiffCommentMetadata>['renderAnnotation']>
      >[0],
    ) => renderCommentAnnotation(annotation as DiffLineAnnotation<DiffCommentMetadata>),
    [renderCommentAnnotation],
  )

  const fileIdentityByPath = useMemo(() => {
    const next = new Map<string, { fileKey: string; filePath: string }>()
    for (const fileDiff of renderableFiles) {
      const identity = getDiffFileIdentity(fileDiff)
      next.set(identity.filePath, identity)
    }
    return next
  }, [renderableFiles])

  const handleCodeViewPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const filePath = (event.target as HTMLElement | null)
        ?.closest<HTMLElement>('[data-diff-file-path]')
        ?.getAttribute('data-diff-file-path')
      if (!filePath) return
      const identity = fileIdentityByPath.get(filePath)
      if (!identity) return
      onFilePointerDownCapture(event, identity.fileKey, identity.filePath)
    },
    [fileIdentityByPath, onFilePointerDownCapture],
  )

  const renderGutterUtility = useCallback(
    (
      getHoveredLine: () => GetHoveredLineResult<'diff'> | undefined,
      item: CodeViewItem<DiffCommentMetadata>,
    ) => {
      const hoveredLine = getHoveredLine()
      const fileDiff = getItemFileDiff(item)
      if (!(hoveredLine && fileDiff)) return null
      const { fileKey, filePath } = getDiffFileIdentity(fileDiff)
      return (
        <Tooltip content="Add comment">
          <button
            type="button"
            className={diffCommentGutterButtonClass}
            onPointerDownCapture={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenDraftComment(fileKey, filePath, hoveredLine.side, hoveredLine.lineNumber)
            }}
            aria-label={`Add comment on ${filePath}:${hoveredLine.lineNumber}`}
          >
            <MessageSquarePlus size={12} />
          </button>
        </Tooltip>
      )
    },
    [onOpenDraftComment],
  )

  return (
    <div className="h-full min-h-0" onPointerDownCapture={handleCodeViewPointerDownCapture}>
      <CodeView<DiffCommentMetadata>
        ref={setCodeViewHandle}
        initialItems={[]}
        selectedLines={selectedLines}
        containerRef={scrollContainerRef}
        className={cn(
          diffFileShellClass,
          'h-full w-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]',
        )}
        options={codeViewOptions}
        renderCustomHeader={renderCustomHeader}
        renderAnnotation={renderAnnotation}
        renderGutterUtility={renderGutterUtility}
      />
    </div>
  )
}
