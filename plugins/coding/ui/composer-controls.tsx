import { GitBranch } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useToolkitExtensionEnabled } from '../../../src/app/extensions/toolkit-context'
import { compactIconButtonClass } from '../../../src/app/ui/classes'
import { cn } from '../../../src/app/utils/cn'
import { ComposerDiffBaselineSelector, getGitOpsEntryButtonClass } from './gitops/index'

export function CodingComposerControls({
  selector,
  showGitOps,
  onOpenGitOps,
}: {
  selector: Omit<
    ComponentProps<typeof ComposerDiffBaselineSelector>,
    'branch' | 'projectGitState'
  > & {
    projectGitState: ComponentProps<typeof ComposerDiffBaselineSelector>['projectGitState'] | null
  }
  showGitOps: boolean
  onOpenGitOps: () => void
}) {
  const enabled = useToolkitExtensionEnabled('coding')
  if (!enabled) return null
  const gitState = selector.projectGitState
  const gitVisualMode = gitState?.isGitRepo
    ? gitState.fileCount > 0
      ? 'dirty'
      : 'clean'
    : 'not-git'
  return (
    <>
      {gitState?.isGitRepo ? (
        <ComposerDiffBaselineSelector
          {...selector}
          branch={gitState.branch}
          projectGitState={gitState}
        />
      ) : null}
      {showGitOps ? (
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            'composer-gitops-control h-7 w-7',
            getGitOpsEntryButtonClass(gitVisualMode),
          )}
          onClick={onOpenGitOps}
          aria-label="Git ops"
          data-tooltip="Git ops"
        >
          <GitBranch size={14} />
        </button>
      ) : null}
    </>
  )
}
