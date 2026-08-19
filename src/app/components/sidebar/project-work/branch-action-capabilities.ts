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
  return group.worktrees.some((worktree) => worktree.complete)
}

function hasMergeableCompletedWorktrees(group: BranchThreadGroup) {
  return group.worktrees.some((worktree) => worktree.complete && Boolean(worktree.branchName))
}

export function getBranchActionCapabilities(
  group: BranchThreadGroup,
  overrides: Partial<BranchActionCapabilities> = {},
): BranchActionCapabilities {
  return {
    canStartThread: true,
    canPrune: group.kind !== 'unassigned',
    canSwitch: group.kind === 'branch' && !group.current,
    canToggleWorktreeComplete: group.kind === 'worktree',
    canMergeWorktree: group.kind === 'worktree' && Boolean(group.worktreeBranchName),
    canMergeCompletedWorktrees: group.kind !== 'worktree' && hasMergeableCompletedWorktrees(group),
    canRemoveCompletedWorktrees: group.kind !== 'worktree' && hasCompletedWorktrees(group),
    canCreateWorktree: canCreateWorktreeFromBranchGroup(group),
    ...overrides,
  }
}

export function getBranchActionCount(capabilities: BranchActionCapabilities) {
  return Object.values(capabilities).filter(Boolean).length
}
