import { describe, expect, it } from 'vitest'
import { parseGitWorktreePorcelain } from './worktrees.ts'

describe('parseGitWorktreePorcelain', () => {
  it('parses main, branch, and detached worktrees', () => {
    expect(
      parseGitWorktreePorcelain(`worktree /repo
HEAD abc123
branch refs/heads/main

worktree /repo/worktrees/feature-a
HEAD def456
branch refs/heads/feature/a

worktree /repo/worktrees/review
HEAD fedcba
detached

worktree /repo/worktrees/stale
HEAD 000000
branch refs/heads/stale
prunable gitdir file points to non-existent location
`),
    ).toEqual([
      { path: '/repo', head: 'abc123', branch: 'main', detached: false, prunable: false },
      {
        path: '/repo/worktrees/feature-a',
        head: 'def456',
        branch: 'feature/a',
        detached: false,
        prunable: false,
      },
      {
        path: '/repo/worktrees/review',
        head: 'fedcba',
        branch: null,
        detached: true,
        prunable: false,
      },
      {
        path: '/repo/worktrees/stale',
        head: '000000',
        branch: 'stale',
        detached: false,
        prunable: true,
      },
    ])
  })
})
