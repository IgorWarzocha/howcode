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
`),
    ).toEqual([
      { path: '/repo', head: 'abc123', branch: 'main', detached: false },
      { path: '/repo/worktrees/feature-a', head: 'def456', branch: 'feature/a', detached: false },
      { path: '/repo/worktrees/review', head: 'fedcba', branch: null, detached: true },
    ])
  })
})
