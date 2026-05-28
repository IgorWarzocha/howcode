import { describe, expect, it } from 'vitest'
import { getWorktreeParentBranchName } from '../app/components/sidebar/project-work/branch-row-actions'
import {
  canCreateWorktreeFromBranchGroup,
  shouldShowBranchGroupDividerAfter,
  shouldShowBranchGroupDividerBefore,
} from '../app/components/sidebar/project-work/branch-thread-groups'
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
  it('only allows child worktree creation from the active branch row', () => {
    expect(canCreateWorktreeFromBranchGroup(group({ current: true }))).toBe(true)
    expect(canCreateWorktreeFromBranchGroup(group({ current: false }))).toBe(false)
  })

  it('shows dividers around branch groups that contain worktrees', () => {
    expect(
      shouldShowBranchGroupDividerAfter(
        group({ worktrees: [{ id: 'wt', label: 'wt', path: '/repo/wt', threads: [] }] }),
        true,
      ),
    ).toBe(true)
    expect(
      shouldShowBranchGroupDividerAfter(
        group({ worktrees: [{ id: 'wt', label: 'wt', path: '/repo/wt', threads: [] }] }),
        false,
      ),
    ).toBe(false)
    expect(
      shouldShowBranchGroupDividerAfter(
        group({ completedWorktrees: [{ label: 'done', path: '/repo/done' }] }),
        true,
      ),
    ).toBe(true)
    expect(shouldShowBranchGroupDividerAfter(group({ worktrees: [] }), true)).toBe(false)
    expect(
      shouldShowBranchGroupDividerBefore(
        group({ worktrees: [{ id: 'wt', label: 'wt', path: '/repo/wt', threads: [] }] }),
        0,
      ),
    ).toBe(false)
    expect(
      shouldShowBranchGroupDividerBefore(
        group({ worktrees: [{ id: 'wt', label: 'wt', path: '/repo/wt', threads: [] }] }),
        1,
      ),
    ).toBe(true)
  })

  it('uses the current row label as parent when git state current branch is unavailable', () => {
    expect(getWorktreeParentBranchName(group({ current: true }), null)).toBe('post-0.1.66-fixes')
  })

  it('prefers the resolved current branch for the active branch row', () => {
    expect(getWorktreeParentBranchName(group({ current: true }), 'dev')).toBe('dev')
  })
})
