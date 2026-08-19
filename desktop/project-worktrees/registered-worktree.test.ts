import { describe, expect, it } from 'vitest'
import { getWorktreeMergeTargetError, type RegisteredWorktree } from './registered-worktree.ts'

const baseWorktree: RegisteredWorktree = {
  rootProjectId: '/repo',
  worktreePath: '/repo-worktrees/feature',
  branchName: 'feature',
  parentBranchName: 'dev',
  currentRootBranchName: 'dev',
}

describe('worktree merge target guard', () => {
  it('rejects any target that cannot safely merge into the checked-out parent', () => {
    expect(getWorktreeMergeTargetError(baseWorktree)).toBeNull()
    expect(getWorktreeMergeTargetError({ ...baseWorktree, currentRootBranchName: 'main' })).toBe(
      'Switch the parent worktree to dev before merging.',
    )
    expect(getWorktreeMergeTargetError({ ...baseWorktree, branchName: null })).toBe(
      'Detached worktrees cannot be merged automatically.',
    )
  })
})
