import { describe, expect, it } from 'vitest'
import {
  getBranchActionCapabilities,
  getBranchActionCount,
} from '../app/components/sidebar/project-work/branch-action-capabilities'
import type { BranchThreadGroup } from '../app/components/sidebar/project-work/branch-group-model'

function branchGroup(overrides: Partial<BranchThreadGroup> = {}): BranchThreadGroup {
  return {
    id: 'branch',
    label: 'branch',
    threads: [],
    worktrees: [],
    current: false,
    unassigned: false,
    worktree: false,
    ...overrides,
  }
}

describe('sidebar branch action capabilities', () => {
  it('derives ordinary, current, worktree, and unassigned action sets', () => {
    expect(getBranchActionCapabilities(branchGroup())).toEqual({
      canStartThread: true,
      canPrune: true,
      canSwitch: true,
      canToggleWorktreeComplete: false,
      canMergeWorktree: false,
      canMergeCompletedWorktrees: false,
      canRemoveCompletedWorktrees: false,
      canCreateWorktree: false,
    })

    expect(
      getBranchActionCapabilities(
        branchGroup({
          current: true,
          completedWorktrees: [{ label: 'done', path: '/done', branchName: 'done' }],
        }),
      ),
    ).toMatchObject({
      canCreateWorktree: true,
      canMergeCompletedWorktrees: true,
      canRemoveCompletedWorktrees: true,
      canSwitch: false,
    })

    expect(
      getBranchActionCapabilities(
        branchGroup({ worktree: true, worktreeBranchName: 'feature', worktreePath: '/feature' }),
      ),
    ).toMatchObject({
      canMergeWorktree: true,
      canPrune: true,
      canToggleWorktreeComplete: true,
    })

    expect(getBranchActionCapabilities(branchGroup({ unassigned: true }))).toEqual({
      canStartThread: true,
      canPrune: false,
      canSwitch: false,
      canToggleWorktreeComplete: false,
      canMergeWorktree: false,
      canMergeCompletedWorktrees: false,
      canRemoveCompletedWorktrees: false,
      canCreateWorktree: false,
    })
  })

  it('supports display-context overrides and counts enabled actions', () => {
    const capabilities = getBranchActionCapabilities(branchGroup({ current: true }), {
      canStartThread: true,
      canPrune: false,
      canCreateWorktree: false,
    })

    expect(getBranchActionCount(capabilities)).toBe(1)
  })
})
