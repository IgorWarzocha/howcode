import { describe, expect, it } from 'vitest'
import { getWorktreeMergeTargetError, type RegisteredWorktree } from './registered-worktree.ts'

const baseWorktree: RegisteredWorktree = {
  rootProjectId: '/repo',
  projectId: '/repo-worktrees/feature',
  worktreePath: '/repo-worktrees/feature',
  branchName: 'feature',
  parentBranchName: 'dev',
  currentRootBranchName: 'dev',
  metadata: {
    cwd: '/repo-worktrees/feature',
    rootCwd: '/repo',
    branchName: 'feature',
    parentBranchName: 'dev',
    isMain: false,
    source: 'howcode',
    completed: false,
  },
}

describe('worktree merge target guard', () => {
  it('rejects any target that cannot safely merge into the checked-out parent', () => {
    expect(getWorktreeMergeTargetError(baseWorktree)).toBeNull()
    expect(getWorktreeMergeTargetError({ ...baseWorktree, currentRootBranchName: 'main' })).toBe(
      'Switch the parent worktree to dev before merging.',
    )
    expect(getWorktreeMergeTargetError({ ...baseWorktree, currentRootBranchName: null })).toBe(
      'The parent worktree has no active branch.',
    )
    expect(getWorktreeMergeTargetError({ ...baseWorktree, branchName: null })).toBe(
      'Detached worktrees cannot be merged automatically.',
    )
    expect(
      getWorktreeMergeTargetError({
        ...baseWorktree,
        parentBranchName: null,
        metadata: { ...baseWorktree.metadata!, parentBranchName: null },
      }),
    ).toBe('Managed worktrees require a recorded parent branch before merging.')
  })
})
