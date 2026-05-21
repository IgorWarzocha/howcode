import { DiffPanelContent, DiffWorkerPoolProvider } from '@howcode/diff'
import type { ProjectDiffBaseline } from '../../desktop/types'

type DiffPanelProps = {
  projectId: string
  isGitRepo: boolean
  baseline: ProjectDiffBaseline | null
  selectedFilePath: string | null
  selectedCommentId: string | null
  selectedCommentJumpKey: number
  diffRenderMode: 'stacked' | 'split'
  layoutMode?: 'split' | 'overlay' | 'main'
  showFileTree?: boolean
  loading?: boolean
}

export function DiffPanel({
  projectId,
  isGitRepo,
  baseline,
  selectedFilePath,
  selectedCommentId,
  selectedCommentJumpKey,
  diffRenderMode,
  layoutMode = 'split',
  showFileTree = true,
  loading = false,
}: DiffPanelProps) {
  return (
    <DiffWorkerPoolProvider>
      <DiffPanelContent
        projectId={projectId}
        isGitRepo={isGitRepo}
        baseline={baseline}
        selectedFilePath={selectedFilePath}
        selectedCommentId={selectedCommentId}
        selectedCommentJumpKey={selectedCommentJumpKey}
        diffRenderMode={diffRenderMode}
        layoutMode={layoutMode}
        showFileTree={showFileTree}
        loading={loading}
      />
    </DiffWorkerPoolProvider>
  )
}
