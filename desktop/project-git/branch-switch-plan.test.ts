import { describe, expect, it } from 'vitest'
import { createBranchSwitchPlan } from './branch-switch-plan.ts'

describe('createBranchSwitchPlan', () => {
  it('tracks origin remote branches before creating new branches', () => {
    expect(
      createBranchSwitchPlan({
        branchName: 'feature/a',
        localBranches: new Set(['main']),
        remoteBranches: ['upstream/feature/a', 'origin/feature/a'],
      }),
    ).toEqual({ kind: 'remote', args: ['switch', '--track', 'origin/feature/a'] })
  })

  it('creates a new branch when no local or remote branch matches', () => {
    expect(
      createBranchSwitchPlan({
        branchName: 'feature/a',
        localBranches: new Set(['main']),
        remoteBranches: [],
      }),
    ).toEqual({ kind: 'create', args: ['switch', '--create', 'feature/a'] })
  })
})
