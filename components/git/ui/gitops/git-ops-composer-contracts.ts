import type {
  DirectoryDiffBaseline,
  DirectoryDiffRenderMode,
  DirectoryGitState,
} from '../../../../src/app/desktop/types'

export type GitOpsComposerDirectory = {
  id: string
  gitState: DirectoryGitState | null
  parentBranchName?: string | null | undefined
  conversationId: string | null
}

export type GitOpsComposerDiff = {
  baseline: DirectoryDiffBaseline
  renderMode: DirectoryDiffRenderMode
  loadError: string | null
  includeUntracked: boolean
  setBaseline: (baseline: DirectoryDiffBaseline) => void
  setRenderMode: (mode: DirectoryDiffRenderMode) => void
  toggleIncludeUntracked: () => void
}

export type GitOpsFileTreeControl = {
  visible: boolean
  toggle: () => void
}
