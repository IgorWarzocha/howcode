import type { BranchThreadGroup } from './branch-group-model'

export function getWorktreeParentBranchName(
  group: BranchThreadGroup,
  currentBranch: string | null,
) {
  if (group.current) return currentBranch?.trim() || group.label
  if (group.worktree || group.unassigned) return null
  return group.label
}
