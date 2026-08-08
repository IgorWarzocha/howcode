import type { CodeViewItem, CodeViewOptions } from '@pierre/diffs'
import { CodeView, type CodeViewHandle, type FileDiffMetadata } from '@pierre/diffs/react'
import { useCallback, useMemo } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import { diffFileShellClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import type { ReviewAnnotationMetadata } from '../review/pierre-review-adapter'
import type { ReviewCodeViewController } from '../review/review-code-view'
import { usePierreReviewCodeView } from '../review/use-pierre-review-code-view'
import { DiffImagePreview } from './diff-image-preview'
import {
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  DIFF_FILE_ESTIMATED_LINE_HEIGHT,
  DIFF_PANEL_UNSAFE_CSS,
  isImageDiffFile,
} from './diff-panel-content.helpers'
import { DiffPanelFileHeader } from './diff-panel-file-header'
import { DIFF_THEMES } from './diff-rendering'
import { getDiffFileIdentity, useDiffCodeViewItems } from './use-diff-code-view-items'

type DiffPanelFileListProps = {
  baseline: ProjectDiffBaseline | null
  codeViewRef: React.RefObject<CodeViewHandle<ReviewAnnotationMetadata> | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  collapsedFiles: Record<string, boolean>
  diffRenderMode: 'stacked' | 'split'
  focusedImageFileKeys: ReadonlySet<string>
  onToggleFileCollapsed: (fileKey: string) => void
  projectId: string
  review: ReviewCodeViewController
  renderableFiles: FileDiffMetadata[]
}

function getItemFileDiff(item: CodeViewItem<ReviewAnnotationMetadata>) {
  return item.type === 'diff' ? item.fileDiff : null
}

export function DiffPanelFileList({
  baseline,
  codeViewRef,
  scrollContainerRef,
  collapsedFiles,
  diffRenderMode,
  focusedImageFileKeys,
  onToggleFileCollapsed,
  projectId,
  review,
  renderableFiles,
}: DiffPanelFileListProps) {
  const setHandle = useDiffCodeViewItems({
    annotationsByFile: review.annotationsByFile,
    collapsedFiles,
    codeViewRef,
    focusedImageFileKeys,
    renderableFiles,
  })

  const codeViewOptions = useMemo<CodeViewOptions<ReviewAnnotationMetadata>>(
    () => ({
      diffStyle: diffRenderMode === 'split' ? 'split' : 'unified',
      lineDiffType: 'none',
      overflow: 'wrap',
      theme: DIFF_THEMES,
      themeType: 'system',
      unsafeCSS: DIFF_PANEL_UNSAFE_CSS,
      enableGutterUtility: true,
      enableLineSelection: true,
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
    }),
    [diffRenderMode],
  )

  const renderCustomHeader = useCallback(
    (item: CodeViewItem<ReviewAnnotationMetadata>) => {
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
            <DiffImagePreview baseline={baseline} fileDiff={fileDiff} projectId={projectId} />
          ) : null}
        </div>
      )
    },
    [baseline, onToggleFileCollapsed, projectId],
  )

  const fileIdentityByKey = useMemo(() => {
    const next = new Map<string, { fileKey: string; filePath: string }>()
    for (const fileDiff of renderableFiles) {
      const identity = getDiffFileIdentity(fileDiff)
      next.set(identity.fileKey, identity)
    }
    return next
  }, [renderableFiles])
  const { onSelectedLinesChange, renderAnnotation, renderGutterUtility, selectedLines } =
    usePierreReviewCodeView({ fileIdentityByKey, review })

  return (
    <div className="h-full min-h-0">
      <CodeView<ReviewAnnotationMetadata>
        ref={setHandle}
        initialItems={[]}
        selectedLines={selectedLines}
        onSelectedLinesChange={onSelectedLinesChange}
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
