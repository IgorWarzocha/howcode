import type {
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
} from '../../desktop/types'

export type GitOpsComposerProject = {
  id: string
  gitState: ProjectGitState | null
  parentBranchName?: string | null | undefined
  sessionPath: string | null
}

export type GitOpsComposerDiff = {
  baseline: ProjectDiffBaseline
  renderMode: ProjectDiffRenderMode
  loadError: string | null
  includeUntracked: boolean
  setBaseline: (baseline: ProjectDiffBaseline) => void
  setRenderMode: (mode: ProjectDiffRenderMode) => void
  toggleIncludeUntracked: () => void
}

export type GitOpsFileTreeControl = {
  visible: boolean
  toggle: () => void
}
