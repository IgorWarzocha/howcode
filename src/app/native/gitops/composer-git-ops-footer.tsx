import { Columns2, Rows3 } from 'lucide-react'
import type { RefObject } from 'react'
import { compactIconButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import {
  workspaceFooterRowClass,
  workspaceFooterTrailingGroupClass,
} from '../../workspace-shell/footer/workspace-footer-primitives'
import { ComposerDiffBaselineSelector } from './composer-diff-baseline-selector'
import { ComposerGitOpsBackButton } from './composer-git-ops-back-button'
import { ComposerGitOpsSettings } from './composer-git-ops-settings'
import type { GitOpsComposerDiff, GitOpsComposerProject } from './git-ops-composer-contracts'
import type { GitOpsReviewController } from './review/review-controller'
import type { ComposerGitOpsState } from './useComposerGitOpsState'

type ComposerGitOpsFooterProps = {
  composerPanelRef: RefObject<HTMLDivElement | null>
  diff: GitOpsComposerDiff
  onBack: () => void
  options: ComposerGitOpsState['options']
  project: GitOpsComposerProject
  repository: ComposerGitOpsState['repository']
  review: Pick<GitOpsReviewController, 'discard' | 'hasPendingReview'>
}

function DiffLayoutControls({ diff }: { diff: GitOpsComposerDiff }) {
  return (
    <>
      <button
        type="button"
        className={cn(
          compactIconButtonClass,
          'h-7 w-7',
          diff.renderMode === 'stacked' &&
            'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
        )}
        onClick={() => diff.setRenderMode('stacked')}
        aria-label="Unified diff view"
        data-tooltip="Unified diff view"
      >
        <Rows3 size={14} />
      </button>
      <button
        type="button"
        className={cn(
          compactIconButtonClass,
          'h-7 w-7',
          diff.renderMode === 'split' && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
        )}
        onClick={() => diff.setRenderMode('split')}
        aria-label="Split diff view"
        data-tooltip="Split diff view"
      >
        <Columns2 size={14} />
      </button>
    </>
  )
}

export function ComposerGitOpsFooter({
  composerPanelRef,
  diff,
  onBack,
  options,
  project,
  repository,
  review,
}: ComposerGitOpsFooterProps) {
  return (
    <div className={workspaceFooterRowClass}>
      {repository.isGitRepo ? (
        <div className="inline-flex items-center gap-1.5">
          <ComposerGitOpsSettings
            composerPanelRef={composerPanelRef}
            hasOrigin={repository.hasOrigin}
            includeUntracked={diff.includeUntracked}
            onToggleIncludeUntracked={diff.toggleIncludeUntracked}
            options={options}
            usesAppDefault={project.gitState?.gitOpsModeOverride === null}
          />
          <DiffLayoutControls diff={diff} />
        </div>
      ) : null}

      <div className={cn(workspaceFooterTrailingGroupClass, 'relative')}>
        {repository.isGitRepo ? (
          <ComposerDiffBaselineSelector
            composerPanelRef={composerPanelRef}
            branch={project.gitState?.branch ?? null}
            parentBranchName={project.parentBranchName}
            projectId={project.gitState?.projectId ?? ''}
            projectGitState={project.gitState}
            selectedBaseline={diff.baseline}
            onSelectBaseline={diff.setBaseline}
            includeUntracked={diff.includeUntracked}
          />
        ) : null}
        <ComposerGitOpsBackButton
          hasPendingReview={review.hasPendingReview}
          onBack={onBack}
          onDiscardReview={review.discard}
        />
      </div>
    </div>
  )
}
