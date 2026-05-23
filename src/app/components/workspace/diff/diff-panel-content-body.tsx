import type { SelectedLineRange } from '@pierre/diffs'
import type { CodeViewHandle, DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/react'
import type { ReactNode, RefObject } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import type { useDesktopDiff } from '../../../hooks/useDesktopDiff'
import {
  appToneMutedClass,
  appTypeCodeClass,
  appTypeMetaClass,
  appTypeSmallClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { getDiffBaselinePrefix, getResolvedDiffBaselineLabel } from '../composer/diff-baseline'
import { DiffChangedFilesTree } from './diff-changed-files-tree'
import type { DiffCommentMetadata } from './diff-panel-content.helpers'
import type { RenderablePatch } from './diff-panel-content.types'
import { DiffPanelEmptyState } from './diff-panel-empty-state'
import { DiffPanelFileList } from './diff-panel-file-list'
import { DiffPanelSkeleton } from './diff-panel-skeleton'
import type { useDiffCommentDrafting } from './useDiffCommentDrafting'

type DiffPanelContentBodyProps = {
  baseline: ProjectDiffBaseline | null
  collapsedFiles: Record<string, boolean>
  commentAnnotationsByFile: Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>
  diff: ReturnType<typeof useDesktopDiff>['diff']
  diffContentReady: boolean
  diffRenderMode: 'stacked' | 'split'
  draftSelectedLines: SelectedLineRange | null
  error: string | null
  codeViewRef: RefObject<CodeViewHandle<DiffCommentMetadata> | null>
  focusedImageFileKeys: ReadonlySet<string>
  focusedFilePaths: readonly string[]
  getFileInteractionHandlers: ReturnType<
    typeof useDiffCommentDrafting
  >['getFileInteractionHandlers']
  getSelectedLinesForFile: ReturnType<typeof useDiffCommentDrafting>['getSelectedLinesForFile']
  hasFocusedFiles: boolean
  hasNoNetChanges: boolean
  hasResolvedPatch: boolean
  isGitRepo: boolean
  isLoading: boolean
  loading: boolean
  openDraftComment: ReturnType<typeof useDiffCommentDrafting>['openDraftComment']
  projectId: string
  renderCommentAnnotation: (annotation: DiffLineAnnotation<DiffCommentMetadata>) => ReactNode
  renderableFiles: FileDiffMetadata[]
  renderablePatch: RenderablePatch | null
  renderFileTree: boolean
  scrollContainerRef: RefObject<HTMLDivElement | null>
  setFocusedFilePaths: (paths: readonly string[]) => void
  showFileTree: boolean
  toggleFileCollapsed: (fileKey: string) => void
  visibleRenderableFiles: FileDiffMetadata[]
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
    <div
      className={cn(
        'flex h-full items-center justify-center px-3 py-2 text-center',
        appTypeSmallClass,
        appToneMutedClass,
      )}
    >
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
        <p className={cn(appTypeMetaClass, appToneMutedClass)}>{reason}</p>
        <pre
          className={cn(
            'max-h-[70vh] overflow-auto rounded-xl border border-[color:var(--border)] bg-[rgba(18,20,28,0.7)] p-3 text-[color:var(--text)]/90',
            appTypeCodeClass,
          )}
        >
          {text}
        </pre>
      </div>
    </div>
  )
}

function DiffFilesView(input: DiffPanelContentBodyProps) {
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
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden [overflow-anchor:none]">
          {input.renderablePatch?.kind === 'files' ? (
            <DiffPanelFileList
              baseline={input.baseline}
              codeViewRef={input.codeViewRef}
              scrollContainerRef={input.scrollContainerRef}
              collapsedFiles={input.collapsedFiles}
              commentAnnotationsByFile={input.commentAnnotationsByFile}
              diffRenderMode={input.diffRenderMode}
              draftSelectedLines={input.draftSelectedLines}
              focusedImageFileKeys={input.focusedImageFileKeys}
              getFileInteractionHandlers={input.getFileInteractionHandlers}
              getSelectedLinesForFile={input.getSelectedLinesForFile}
              onOpenDraftComment={input.openDraftComment}
              onToggleFileCollapsed={input.toggleFileCollapsed}
              projectId={input.projectId}
              renderCommentAnnotation={input.renderCommentAnnotation}
              renderableFiles={input.visibleRenderableFiles}
            />
          ) : null}
        </div>
        <div
          className="min-h-0 shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out"
          style={{
            width: input.showFileTree ? 'min(24rem, calc(100% - 2.5rem))' : 0,
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

export function DiffPanelContentBody(input: DiffPanelContentBodyProps) {
  if (input.loading) {
    return (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <DiffPanelSkeleton showFileTree={input.showFileTree} />
      </div>
    )
  }
  if (!input.isGitRepo) {
    return (
      <DiffPanelEmptyState message="Diffs are unavailable because this project is not a git repository." />
    )
  }
  if (
    (input.isLoading || input.hasResolvedPatch) &&
    !input.hasNoNetChanges &&
    !input.renderablePatch
  ) {
    return (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <DiffPanelSkeleton showFileTree={input.showFileTree} />
      </div>
    )
  }
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
