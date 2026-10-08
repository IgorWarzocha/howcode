import type { BranchWorkspace } from './branch-group-model'

export function canCreateWorktreeFromBranchGroup(group: BranchWorkspace) {
  return group.kind === 'branch' && group.current
}

export function branchGroupHasWorktreeDivider(group: BranchWorkspace) {
  return group.worktrees.length > 0
}

export function shouldShowBranchGroupDividerAfter(group: BranchWorkspace, hasNextGroup: boolean) {
  return hasNextGroup && branchGroupHasWorktreeDivider(group)
}

export function shouldShowBranchGroupDividerBefore(group: BranchWorkspace, index: number) {
  return index > 0 && branchGroupHasWorktreeDivider(group)
}

export function shouldSeparateBranchGroups(
  group: BranchWorkspace,
  nextGroup: BranchWorkspace | undefined,
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
