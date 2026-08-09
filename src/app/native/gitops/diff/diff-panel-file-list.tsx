import type { CodeViewItem, CodeViewOptions } from '@pierre/diffs'
import {
  CodeView,
  type CodeViewHandle,
  EditProvider,
  type FileDiffMetadata,
} from '@pierre/diffs/react'
import { useCallback, useMemo } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import { diffFileShellClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { createPierreEditor, pierreEditorOptions } from '../edit/pierre-editor'
import type { DiffEditingController } from '../edit/use-diff-editing'
import type { GitOpsAnnotationMetadata } from '../review/pierre-review-adapter'
import type { ReviewCodeViewController } from '../review/review-code-view'
import { useDiffChangeReview } from '../review/use-diff-change-review'
import { usePierreReviewCodeView } from '../review/use-pierre-review-code-view'
import { getDiffFileIdentity } from './diff-file-identity'
import { DiffImagePreview } from './diff-image-preview'
import {
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  DIFF_FILE_ESTIMATED_LINE_HEIGHT,
  DIFF_FULL_CONTEXT_EXPANSION_LINE_COUNT,
  DIFF_PANEL_UNSAFE_CSS,
  isImageDiffFile,
} from './diff-panel-content.helpers'
import { DiffPanelFileHeader } from './diff-panel-file-header'
import { DIFF_THEMES } from './diff-rendering'
import { useDiffCodeViewItems } from './use-diff-code-view-items'
import type { DiffFileContentController } from './use-diff-file-content'

type DiffPanelFileListProps = {
  baseline: ProjectDiffBaseline | null
  codeViewRef: React.RefObject<CodeViewHandle<GitOpsAnnotationMetadata> | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  collapsedFiles: Record<string, boolean>
  diffRenderMode: 'stacked' | 'split'
  editing: DiffEditingController
  fileContent: DiffFileContentController
  focusedImageFileKeys: ReadonlySet<string>
  onToggleFileCollapsed: (fileKey: string) => void
  projectId: string
  review: ReviewCodeViewController
  renderableFiles: FileDiffMetadata[]
}

function getItemFileDiff(item: CodeViewItem<GitOpsAnnotationMetadata>) {
  return item.type === 'diff' ? item.fileDiff : null
}

export function DiffPanelFileList({
  baseline,
  codeViewRef,
  scrollContainerRef,
  collapsedFiles,
  diffRenderMode,
  editing,
  fileContent,
  focusedImageFileKeys,
  onToggleFileCollapsed,
  projectId,
  review,
  renderableFiles,
}: DiffPanelFileListProps) {
  const changeReview = useDiffChangeReview(renderableFiles)
  const annotationsByFile = useMemo(() => {
    const merged = new Map(review.annotationsByFile)
    const editingFileKey = editing.state.kind === 'idle' ? null : editing.state.fileKey
    for (const [fileKey, changeAnnotations] of changeReview.annotationsByFile) {
      if (fileKey === editingFileKey) continue
      merged.set(fileKey, [...changeAnnotations, ...(merged.get(fileKey) ?? [])])
    }
    return merged
  }, [changeReview.annotationsByFile, editing.state, review.annotationsByFile])
  const setHandle = useDiffCodeViewItems({
    annotationsByFile,
    collapsedFiles,
    codeViewRef,
    focusedImageFileKeys,
    renderableFiles: changeReview.files,
    editing,
  })

  const codeViewOptions = useMemo<CodeViewOptions<GitOpsAnnotationMetadata>>(
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
      loadDiffFiles: fileContent.loadFiles,
      expansionLineCount: DIFF_FULL_CONTEXT_EXPANSION_LINE_COUNT,
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
    [diffRenderMode, fileContent.loadFiles],
  )

  const renderCustomHeader = useCallback(
    (item: CodeViewItem<GitOpsAnnotationMetadata>) => {
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
            changeReview={{
              reset: () => changeReview.reset(fileKey),
              reviewed: changeReview.reviewedFileKeys.has(fileKey),
            }}
            editing={editing}
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
    [
      baseline,
      changeReview.reset,
      changeReview.reviewedFileKeys,
      editing,
      onToggleFileCollapsed,
      projectId,
    ],
  )

  const fileIdentityByKey = useMemo(() => {
    const next = new Map<string, { fileKey: string; filePath: string }>()
    for (const fileDiff of changeReview.files) {
      const identity = getDiffFileIdentity(fileDiff)
      next.set(identity.fileKey, identity)
    }
    return next
  }, [changeReview.files])
  const { onSelectedLinesChange, renderAnnotation, renderGutterUtility, selectedLines } =
    usePierreReviewCodeView({ changeReview, fileIdentityByKey, review })

  return (
    <EditProvider<GitOpsAnnotationMetadata> createEditor={createPierreEditor}>
      <div className="h-full min-h-0">
        <CodeView<GitOpsAnnotationMetadata>
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
          editorOptions={pierreEditorOptions}
          onItemEditChange={editing.onItemEditChange}
          renderCustomHeader={renderCustomHeader}
          renderAnnotation={renderAnnotation}
          renderGutterUtility={renderGutterUtility}
        />
      </div>
    </EditProvider>
  )
}
