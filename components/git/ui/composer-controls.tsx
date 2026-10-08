import { GitBranch } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useToolkitComponentEnabled } from '../../../src/app/component-system/component-context'
import { compactIconButtonClass } from '../../../src/app/ui/classes'
import { cn } from '../../../src/app/utils/cn'
import { ComposerDiffBaselineSelector, getGitOpsEntryButtonClass } from './gitops/index'
import { useGitDiffSummary } from './workspace/diff-presentation'

function GitOpsEntryButton({
  gitVisualMode,
}: {
  gitVisualMode: Parameters<typeof getGitOpsEntryButtonClass>[0]
}) {
  const { requestDetail } = useGitDiffSummary()
  return (
    <button
      type="button"
      className={cn(
        compactIconButtonClass,
        'composer-gitops-control h-7 w-7',
        getGitOpsEntryButtonClass(gitVisualMode),
      )}
      onClick={requestDetail}
      aria-label="Git ops"
      data-tooltip="Git ops"
    >
      <GitBranch size={14} />
    </button>
  )
}

export function GitComposerControls({
  selector,
  showGitOps,
}: {
  selector: Omit<
    ComponentProps<typeof ComposerDiffBaselineSelector>,
    'branch' | 'directoryGitState'
  > & {
    directoryGitState:
      | ComponentProps<typeof ComposerDiffBaselineSelector>['directoryGitState']
      | null
  }
  showGitOps: boolean
}) {
  const enabled = useToolkitComponentEnabled('coding')
  if (!enabled) return null
  const gitState = selector.directoryGitState
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
          directoryGitState={gitState}
        />
      ) : null}
      {showGitOps ? <GitOpsEntryButton gitVisualMode={gitVisualMode} /> : null}
    </>
  )
}
