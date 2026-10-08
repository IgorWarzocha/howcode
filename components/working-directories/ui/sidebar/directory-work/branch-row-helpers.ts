import type { BranchWorkspace } from './branch-group-model'

export function getWorktreeParentBranchName(group: BranchWorkspace, currentBranch: string | null) {
  if (group.kind === 'branch' && group.current) return currentBranch?.trim() || group.label
  if (group.kind !== 'branch') return null
  return group.label
}
