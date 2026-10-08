import { DiffWorkerProvider } from '@howaboua/pi-durable-ui/react/diff'
import DiffsWorker from '@pierre/diffs/worker/worker.js?worker'
import type { DirectoryDiffBaseline } from '../../../../src/app/desktop/types'
import { DiffPanelContent } from './diff/diff-panel-content'
import type { GitOpsFileActions } from './edit/gitops-file-actions'

const createDiffWorker = () => new DiffsWorker()

type DiffPanelProps = {
  directoryId: string
  fileActions: GitOpsFileActions
  isGitRepo: boolean
  baseline: DirectoryDiffBaseline | null
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
  directoryId,
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
    <DiffWorkerProvider workerFactory={createDiffWorker}>
      <DiffPanelContent
        key={directoryId}
        fileActions={fileActions}
        directoryId={directoryId}
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
    </DiffWorkerProvider>
  )
}
