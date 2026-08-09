import type { CodeViewHandle, FileDiffMetadata } from '@pierre/diffs/react'
import type { RefObject } from 'react'
import type { ProjectDiffBaseline } from '../../../desktop/types'
import type { useDesktopDiff } from '../../../hooks/useDesktopDiff'
import {
  appToneMutedClass,
  appTypeCodeClass,
  appTypeMetaClass,
  appTypeSmallClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { getDiffBaselinePrefix, getResolvedDiffBaselineLabel } from '../diff-baseline'
import type { DiffEditingController } from '../edit/use-diff-editing'
import type { GitOpsAnnotationMetadata } from '../review/pierre-review-adapter'
import type { ReviewCodeViewController } from '../review/review-code-view'
import { DiffChangedFilesTree } from './diff-changed-files-tree'
import type { RenderablePatch } from './diff-panel-content.types'
import { DiffPanelEmptyState } from './diff-panel-empty-state'
import { DiffPanelFileList } from './diff-panel-file-list'
import type { DiffFileContentController } from './use-diff-file-content'

type DiffPanelContentBodyProps = {
  projectId: string
  diff: {
    baseline: ProjectDiffBaseline | null
    error: string | null
    hasNoNetChanges: boolean
    hasResolvedPatch: boolean
    isGitRepo: boolean
    isLoading: boolean
    loading: boolean
    renderablePatch: RenderablePatch | null
    result: ReturnType<typeof useDesktopDiff>['diff']
  }
  files: {
    all: FileDiffMetadata[]
    collapsed: Record<string, boolean>
    focusedImageKeys: ReadonlySet<string>
    toggleCollapsed: (fileKey: string) => void
    visible: FileDiffMetadata[]
  }
  fileTree: {
    focusedPaths: readonly string[]
    hasFocusedFiles: boolean
    render: boolean
    setFocusedPaths: (paths: readonly string[]) => void
    show: boolean
  }
  codeView: {
    ref: RefObject<CodeViewHandle<GitOpsAnnotationMetadata> | null>
    editing: DiffEditingController
    fileContent: DiffFileContentController
    renderMode: 'stacked' | 'split'
    review: ReviewCodeViewController
    scrollContainerRef: RefObject<HTMLDivElement | null>
  }
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
    <div className="relative h-full min-h-0" aria-busy={input.diff.loading || input.diff.isLoading}>
      <div className="flex h-full min-h-0">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden [overflow-anchor:none]">
          <DiffPanelFileList
            baseline={input.diff.baseline}
            fileContent={input.codeView.fileContent}
            editing={input.codeView.editing}
            codeViewRef={input.codeView.ref}
            scrollContainerRef={input.codeView.scrollContainerRef}
            collapsedFiles={input.files.collapsed}
            diffRenderMode={input.codeView.renderMode}
            focusedImageFileKeys={input.files.focusedImageKeys}
            onToggleFileCollapsed={input.files.toggleCollapsed}
            projectId={input.projectId}
            review={input.codeView.review}
            renderableFiles={input.files.visible}
          />
        </div>
        <div
          className="min-h-0 shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out"
          style={{
            width: input.fileTree.show ? 'min(24rem, calc(100% - 2.5rem))' : 0,
            opacity: input.fileTree.show ? 1 : 0,
          }}
          aria-hidden={!input.fileTree.show}
        >
          {input.fileTree.render ? (
            <DiffChangedFilesTree
              files={input.files.all}
              selectedPaths={input.fileTree.focusedPaths}
              focusedFileCount={input.fileTree.hasFocusedFiles ? input.files.visible.length : 0}
              onSelectedPathsChange={input.fileTree.setFocusedPaths}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function DiffPanelContentBody(input: DiffPanelContentBodyProps) {
  if (!input.diff.isGitRepo) {
    return (
      <DiffPanelEmptyState message="Diffs are unavailable because this project is not a git repository." />
    )
  }
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
      {input.diff.renderablePatch?.kind === 'files' ||
      input.diff.loading ||
      (input.diff.isLoading && !input.diff.hasNoNetChanges) ||
      (input.diff.hasResolvedPatch &&
        !(input.diff.hasNoNetChanges || input.diff.renderablePatch)) ? (
        <DiffFilesView {...input} />
      ) : input.diff.renderablePatch ? (
        <RawPatchView
          reason={input.diff.renderablePatch.reason}
          text={input.diff.renderablePatch.text}
        />
      ) : (
        <DiffPanelUnavailable
          baseline={input.diff.baseline}
          diff={input.diff.result}
          error={input.diff.error}
          hasNoNetChanges={input.diff.hasNoNetChanges}
        />
      )}
    </div>
  )
}
