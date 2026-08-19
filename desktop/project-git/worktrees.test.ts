import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { getInRepositoryWorktreePath } from './worktree-excludes.ts'
import {
  createProjectWorktree,
  parseGitWorktreePorcelain,
  removeProjectWorktree,
} from './worktrees.ts'

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
  it('recognizes child folders whose names begin with two dots', () => {
    expect(getInRepositoryWorktreePath('/repo', '/repo/..worktrees/feature')).toBe(
      path.join('..worktrees', 'feature'),
    )
  })

  it('owns a literal in-repository exclusion only for the worktree lifetime', async () => {
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
        worktreeDirectory: './[worktrees]',
      })

      if ('error' in result) throw new Error(result.error)
      await expect(git('status', '--porcelain')).resolves.toMatchObject({ stdout: '' })
      await expect(readFile(path.join(projectId, '.git/info/exclude'), 'utf8')).resolves.toContain(
        '# howcode worktree: /\\[worktrees\\]/feature-test/\n/\\[worktrees\\]/feature-test/',
      )

      const removeResult = await removeProjectWorktree(
        projectId,
        result.projectId,
        result.branchName,
      )
      expect(removeResult).not.toHaveProperty('error')
      await mkdir(result.projectId, { recursive: true })
      await writeFile(path.join(result.projectId, 'ordinary.txt'), 'visible\n')
      await expect(git('status', '--porcelain')).resolves.toMatchObject({
        stdout: '?? [worktrees]/\n',
      })
    } finally {
      await rm(projectId, { recursive: true, force: true })
    }
  })

  it('returns Git canonical paths when the worktree directory is a symlink', async () => {
    const testDirectory = await mkdtemp(path.join(tmpdir(), 'howcode-worktree-symlink-'))
    const projectId = path.join(testDirectory, 'repo')
    const physicalWorktreeDirectory = path.join(testDirectory, 'worktrees')
    const worktreeDirectoryAlias = path.join(testDirectory, 'worktrees-alias')
    await Promise.all([mkdir(projectId), mkdir(physicalWorktreeDirectory)])
    await symlink(physicalWorktreeDirectory, worktreeDirectoryAlias, 'dir')
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
        branchName: 'feature/symlink',
        worktreeDirectory: worktreeDirectoryAlias,
      })

      if ('error' in result) throw new Error(result.error)
      expect(result.projectId).toBe(path.join(physicalWorktreeDirectory, 'feature-symlink'))
    } finally {
      await rm(testDirectory, { recursive: true, force: true })
    }
  })
})
