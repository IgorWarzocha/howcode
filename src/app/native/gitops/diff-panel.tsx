import type { ProjectDiffBaseline } from '../../desktop/types'
import { DiffPanelContent } from './diff/diff-panel-content'
import { DiffWorkerPoolProvider } from './diff/diff-worker-pool-provider'
import type { GitOpsFileActions } from './edit/gitops-file-actions'

type DiffPanelProps = {
  projectId: string
  fileActions: GitOpsFileActions
  isGitRepo: boolean
  baseline: ProjectDiffBaseline | null
  selectedFilePath: string | null
  selectedCommentId: string | null
  selectedCommentJumpKey: number
  diffRenderMode: 'stacked' | 'split'
  layoutMode?: 'split' | 'overlay' | 'main'
  showFileTree?: boolean
  includeUntracked?: boolean
  loading?: boolean
  onLoadErrorChange?: ((error: string | null) => void) | undefined
}

export function DiffPanel({
  fileActions,
  projectId,
  isGitRepo,
  baseline,
  selectedFilePath,
  selectedCommentId,
  selectedCommentJumpKey,
  diffRenderMode,
  layoutMode = 'split',
  showFileTree = true,
  includeUntracked = false,
  loading = false,
  onLoadErrorChange,
}: DiffPanelProps) {
  return (
    <DiffWorkerPoolProvider>
      <DiffPanelContent
        fileActions={fileActions}
        projectId={projectId}
        isGitRepo={isGitRepo}
        baseline={baseline}
        selectedFilePath={selectedFilePath}
        selectedCommentId={selectedCommentId}
        selectedCommentJumpKey={selectedCommentJumpKey}
        diffRenderMode={diffRenderMode}
        layoutMode={layoutMode}
        showFileTree={showFileTree}
        includeUntracked={includeUntracked}
        loading={loading}
        onLoadErrorChange={onLoadErrorChange}
      />
    </DiffWorkerPoolProvider>
  )
}
