const gitDiffPrefixPattern = /^[ab]\//

import type { CodeViewItem, GetHoveredLineResult, SelectedLineRange } from '@pierre/diffs'
import {
  type AnnotationSide,
  CodeView,
  type CodeViewHandle,
  type DiffLineAnnotation,
  type FileDiffMetadata,
} from '@pierre/diffs/react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, MessageSquarePlus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
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
  filePath,
  projectId,
}: {
  baseline: ProjectDiffBaseline | null
  fileDiff: FileDiffMetadata
  filePath: string
  projectId: string
}) {
  const sides: ProjectDiffImageSide[] =
    fileDiff.type === 'new' ? ['new'] : fileDiff.type === 'deleted' ? ['old'] : ['old', 'new']
  return (
    <div className={cn(diffImagePreviewClass, sides.length === 1 && 'md:grid-cols-1')}>
      {sides.map((side) => (
        <DiffImagePreviewPane
          key={side}
          baseline={baseline}
          filePath={filePath}
          projectId={projectId}
          side={side}
        />
      ))}
    </div>
  )
}

function getDiffFileIdentity(fileDiff: FileDiffMetadata) {
  const filePath = fileDiff.name?.replace(gitDiffPrefixPattern, '') ?? fileDiff.prevName ?? ''
  const fileKey = fileDiff.cacheKey ?? `${fileDiff.prevName ?? 'none'}:${fileDiff.name}`
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
      data-tooltip={`${isCollapsed ? 'Expand' : 'Collapse'} ${filePath}`}
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
        return {
          id: fileKey,
          type: 'diff',
          fileDiff,
          annotations: commentAnnotationsByFile.get(fileKey) ?? [],
          collapsed: focusedImageFileKeys.has(fileKey)
            ? false
            : (collapsedFiles[fileKey] ?? isImageFile),
          version: Number(
            `${fileKey.length}${commentAnnotationsByFile.get(fileKey)?.length ?? 0}${collapsedFiles[fileKey] ? 1 : 0}${focusedImageFileKeys.has(fileKey) ? 1 : 0}`,
          ),
        }
      }),
    [collapsedFiles, commentAnnotationsByFile, focusedImageFileKeys, renderableFiles],
  )

  const itemSyncStateRef = useRef<{ ids: string[]; versions: Map<string, number | undefined> }>({
    ids: [],
    versions: new Map(),
  })

  useEffect(() => {
    const codeViewHandle = codeViewRef.current
    const codeView = codeViewHandle?.getInstance()
    if (!(codeViewHandle && codeView)) return

    const previous = itemSyncStateRef.current
    const nextIds = items.map((item) => item.id)
    const previousIds = previous.ids
    const isAppendOnly =
      previousIds.length <= nextIds.length &&
      previousIds.every((previousId, index) => previousId === nextIds[index])

    if (!isAppendOnly) {
      codeView.setItems(items)
      itemSyncStateRef.current = {
        ids: nextIds,
        versions: new Map(items.map((item) => [item.id, item.version])),
      }
      return
    }

    for (const item of items.slice(0, previousIds.length)) {
      if (previous.versions.get(item.id) !== item.version) {
        codeViewHandle.updateItem(item)
      }
    }

    const appendedItems = items.slice(previousIds.length)
    if (appendedItems.length > 0) {
      codeViewHandle.addItems(appendedItems)
    }

    itemSyncStateRef.current = {
      ids: nextIds,
      versions: new Map(items.map((item) => [item.id, item.version])),
    }
  }, [codeViewRef, items])

  const selectedLines = useMemo(() => {
    for (const fileDiff of renderableFiles) {
      const { fileKey } = getDiffFileIdentity(fileDiff)
      const range = getSelectedLinesForFile(fileKey, draftSelectedLines)
      if (range) return { id: fileKey, range }
    }
    return null
  }, [draftSelectedLines, getSelectedLinesForFile, renderableFiles])

  return (
    <CodeView<DiffCommentMetadata>
      ref={codeViewRef}
      initialItems={[]}
      selectedLines={selectedLines}
      containerRef={scrollContainerRef}
      className={cn(
        diffFileShellClass,
        'h-full w-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]',
      )}
      options={{
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
        onLineClick: (lineProps, context) => {
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
        onLineNumberClick: (lineProps, context) => {
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
      }}
      renderCustomHeader={(item) => {
        const fileDiff = getItemFileDiff(item)
        if (!fileDiff) return null
        const { fileKey, filePath } = getDiffFileIdentity(fileDiff)
        const isCollapsed = item.collapsed === true
        const isImageFile = isImageDiffFile(fileDiff)
        return (
          <div
            className={cn(isImageFile && !isCollapsed && diffFileShellClass)}
            data-diff-file-path={filePath}
          >
            <DiffPanelFileHeader
              fileDiff={fileDiff}
              fileKey={fileKey}
              filePath={filePath}
              isCollapsed={isCollapsed}
              onToggleFileCollapsed={onToggleFileCollapsed}
            />
            {isImageFile && !isCollapsed ? (
              <DiffImagePreview
                baseline={baseline}
                fileDiff={fileDiff}
                filePath={filePath}
                projectId={projectId}
              />
            ) : null}
          </div>
        )
      }}
      renderAnnotation={(annotation) =>
        renderCommentAnnotation(annotation as DiffLineAnnotation<DiffCommentMetadata>)
      }
      renderGutterUtility={(getHoveredLine, item) => {
        const hoveredLine = (getHoveredLine as () => GetHoveredLineResult<'diff'> | undefined)()
        const fileDiff = getItemFileDiff(item)
        if (!(hoveredLine && fileDiff)) return null
        const { fileKey, filePath } = getDiffFileIdentity(fileDiff)
        return (
          <button
            type="button"
            className={diffCommentGutterButtonClass}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenDraftComment(fileKey, filePath, hoveredLine.side, hoveredLine.lineNumber)
            }}
            aria-label={`Add comment on ${filePath}:${hoveredLine.lineNumber}`}
            data-tooltip="Add comment"
          >
            <MessageSquarePlus size={12} />
          </button>
        )
      }}
    />
  )
}
