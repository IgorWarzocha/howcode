import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { createProjectWorktree, parseGitWorktreePorcelain } from './worktrees.ts'

const execFileAsync = promisify(execFile)

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

describe('createProjectWorktree', () => {
  it('keeps an in-repository worktree directory out of parent status', async () => {
    const projectId = await mkdtemp(path.join(tmpdir(), 'howcode-worktree-'))
    const git = (...args: string[]) => execFileAsync('git', args, { cwd: projectId })

    try {
      await git('init', '-b', 'main', '--quiet')
      await git('config', 'user.name', 'Howcode Test')
      await git('config', 'user.email', 'howcode-test@example.invalid')
      await writeFile(path.join(projectId, 'vouched.md'), 'base\n')
      await git('add', 'vouched.md')
      await git('commit', '--quiet', '-m', 'base')

      const result = await createProjectWorktree({
        projectId,
        branchName: 'feature/test',
        worktreeDirectory: './.worktrees',
      })

      expect(result).not.toHaveProperty('error')
      await expect(git('status', '--porcelain')).resolves.toMatchObject({ stdout: '' })
      await expect(readFile(path.join(projectId, '.git/info/exclude'), 'utf8')).resolves.toContain(
        '/.worktrees/',
      )
    } finally {
      await rm(projectId, { recursive: true, force: true })
    }
  })
})
