import { canCreateWorktreeFromBranchGroup } from './branch-group-layout'
import type { BranchThreadGroup } from './branch-group-model'

export type BranchActionCapabilities = {
  canStartThread: boolean
  canPrune: boolean
  canSwitch: boolean
  canToggleWorktreeComplete: boolean
  canMergeWorktree: boolean
  canMergeCompletedWorktrees: boolean
  canRemoveCompletedWorktrees: boolean
  canCreateWorktree: boolean
}

function hasCompletedWorktrees(group: BranchThreadGroup) {
  return (
    (group.completedWorktrees?.length ?? 0) > 0 ||
    group.worktrees.some((worktree) => worktree.complete)
  )
}

function hasMergeableCompletedWorktrees(group: BranchThreadGroup) {
  return (
    (group.completedWorktrees?.some((worktree) => Boolean(worktree.branchName)) ?? false) ||
    group.worktrees.some((worktree) => worktree.complete && Boolean(worktree.branchName))
  )
}

export function getBranchActionCapabilities(
  group: BranchThreadGroup,
  overrides: Partial<BranchActionCapabilities> = {},
): BranchActionCapabilities {
  return {
    canStartThread: true,
    canPrune: !group.unassigned,
    canSwitch: !(group.current || group.unassigned || group.worktree),
    canToggleWorktreeComplete: group.worktree,
    canMergeWorktree: group.worktree && Boolean(group.worktreeBranchName),
    canMergeCompletedWorktrees: !group.worktree && hasMergeableCompletedWorktrees(group),
    canRemoveCompletedWorktrees: !group.worktree && hasCompletedWorktrees(group),
    canCreateWorktree: canCreateWorktreeFromBranchGroup(group),
    ...overrides,
  }
}

export function getBranchActionCount(capabilities: BranchActionCapabilities) {
  return Object.values(capabilities).filter(Boolean).length
}
