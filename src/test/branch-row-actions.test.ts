import { describe, expect, it } from 'vitest'
import { getWorktreeParentBranchName } from '../app/components/sidebar/project-work/branch-row-actions'
import type { BranchThreadGroup } from '../app/components/sidebar/project-work/project-work-model'

function group(overrides: Partial<BranchThreadGroup>): BranchThreadGroup {
  return {
    id: 'post-0.1.66-fixes',
    label: 'post-0.1.66-fixes',
    threads: [],
    worktrees: [],
    current: false,
    unassigned: false,
    worktree: false,
    ...overrides,
  }
}

describe('branch row worktree actions', () => {
  it('uses the current row label as parent when git state current branch is unavailable', () => {
    expect(getWorktreeParentBranchName(group({ current: true }), null)).toBe('post-0.1.66-fixes')
  })

  it('prefers the resolved current branch for the active branch row', () => {
    expect(getWorktreeParentBranchName(group({ current: true }), 'dev')).toBe('dev')
  })
})
