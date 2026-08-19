import type { BranchThreadGroup } from './branch-group-model'

export function canCreateWorktreeFromBranchGroup(group: BranchThreadGroup) {
  return group.kind === 'branch' && group.current
}

export function branchGroupHasWorktreeDivider(group: BranchThreadGroup) {
  return group.worktrees.length > 0
}

export function shouldShowBranchGroupDividerAfter(group: BranchThreadGroup, hasNextGroup: boolean) {
  return hasNextGroup && branchGroupHasWorktreeDivider(group)
}

export function shouldShowBranchGroupDividerBefore(group: BranchThreadGroup, index: number) {
  return index > 0 && branchGroupHasWorktreeDivider(group)
}

export function shouldSeparateBranchGroups(
  group: BranchThreadGroup,
  nextGroup: BranchThreadGroup | undefined,
) {
  if (!nextGroup) return false
  const groupIsCheckoutCluster =
    (group.kind === 'branch' && group.current) ||
    group.kind === 'worktree' ||
    group.worktrees.length > 0
  const nextGroupIsCheckoutCluster =
    (nextGroup.kind === 'branch' && nextGroup.current) ||
    nextGroup.kind === 'worktree' ||
    nextGroup.worktrees.length > 0
  return groupIsCheckoutCluster && !nextGroupIsCheckoutCluster
}
