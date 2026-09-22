import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredProjectWorktree } from '../thread-state-db.ts'
import { removeFullCleanProjectDirectories } from './full-clean-removal.ts'

const execFileAsync = promisify(execFile)

describe('full-clean project directory removal', () => {
  let testDirectory: string
  let rootProjectId: string
  let worktreePath: string

  beforeEach(async () => {
    // Commit hooks export repository-local Git paths that must not reach fixture repositories.
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) {
      vi.stubEnv(key, undefined)
    }
    testDirectory = await mkdtemp(path.join(tmpdir(), 'howcode-full-clean-'))
    rootProjectId = path.join(testDirectory, 'repo')
    worktreePath = path.join(testDirectory, 'feature-worktree')
    await mkdir(rootProjectId)

    const git = (cwd: string, ...args: string[]) => execFileAsync('git', args, { cwd })
    await git(rootProjectId, 'init', '-b', 'main', '--quiet')
    await git(rootProjectId, 'config', 'user.name', 'Howcode Test')
    await git(rootProjectId, 'config', 'user.email', 'howcode-test@example.invalid')
    await writeFile(path.join(rootProjectId, 'vouched.md'), 'base\n')
    await git(rootProjectId, 'add', 'vouched.md')
    await git(rootProjectId, 'commit', '--quiet', '-m', 'base')
    await git(rootProjectId, 'worktree', 'add', '--quiet', '-b', 'feature/security', worktreePath)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(testDirectory, { recursive: true, force: true })
  })

  function metadata(branchName = 'feature/security'): StoredProjectWorktree {
    return {
      cwd: worktreePath,
      rootCwd: rootProjectId,
      branchName,
      parentBranchName: 'main',
      isMain: false,
      source: 'howcode',
      completed: false,
    }
  }

  it('removes only a live worktree that Git identifies as part of the project', async () => {
    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      worktrees: [metadata()],
    })

    expect(result).toEqual({})
    await expect(access(rootProjectId)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(worktreePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves an unrelated directory recreated at a stale worktree path', async () => {
    await rm(worktreePath, { recursive: true, force: true })
    await mkdir(worktreePath)
    await execFileAsync('git', ['init', '-b', 'unrelated', '--quiet'], { cwd: worktreePath })
    const unrelatedFile = path.join(worktreePath, 'unrelated.txt')
    await writeFile(unrelatedFile, 'keep me\n')

    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      worktrees: [metadata()],
    })

    expect(result).toHaveProperty('error')
    await expect(readFile(unrelatedFile, 'utf8')).resolves.toBe('keep me\n')
    await expect(access(rootProjectId)).resolves.toBeUndefined()
  })

  it('preserves the project when the persisted worktree branch no longer matches Git', async () => {
    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      worktrees: [metadata('feature/other')],
    })

    expect(result).toHaveProperty('error')
    await expect(access(worktreePath)).resolves.toBeUndefined()
    await expect(access(rootProjectId)).resolves.toBeUndefined()
  })
})
