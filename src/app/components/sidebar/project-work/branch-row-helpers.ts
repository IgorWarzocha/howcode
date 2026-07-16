import type { BranchThreadGroup } from './project-work-model'

export function getWorktreeParentBranchName(
  group: BranchThreadGroup,
  currentBranch: string | null,
) {
  if (group.current) return currentBranch?.trim() || group.label
  if (group.worktree || group.unassigned) return null
  return group.label
}
