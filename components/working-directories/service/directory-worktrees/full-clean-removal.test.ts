import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as gitWorktrees from '../../../git/service/directory-git/worktrees.ts'
import { loadGitRepositoryIdentity } from '../../../git/service/index.ts'
import type { StoredDirectoryWorktree } from '../state.ts'
import { removeFullCleanDirectoryDirectories } from './full-clean-removal.ts'

const execFileAsync = promisify(execFile)

describe('full-clean project directory removal', () => {
  let testDirectory: string
  let rootDirectoryId: string
  let worktreePath: string
  let gitCommonDirectoryIdentity: string

  beforeEach(async () => {
    // Commit hooks export repository-local Git paths that must not reach fixture repositories.
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) {
      vi.stubEnv(key, undefined)
    }
    testDirectory = await mkdtemp(path.join(tmpdir(), 'howcode-full-clean-'))
    rootDirectoryId = path.join(testDirectory, 'repo')
    worktreePath = path.join(testDirectory, 'feature-worktree')
    await mkdir(rootDirectoryId)

    const git = (cwd: string, ...args: string[]) => execFileAsync('git', args, { cwd })
    await git(rootDirectoryId, 'init', '-b', 'main', '--quiet')
    await git(rootDirectoryId, 'config', 'user.name', 'Howcode Test')
    await git(rootDirectoryId, 'config', 'user.email', 'howcode-test@example.invalid')
    await writeFile(path.join(rootDirectoryId, 'vouched.md'), 'base\n')
    await git(rootDirectoryId, 'add', 'vouched.md')
    await git(rootDirectoryId, 'commit', '--quiet', '-m', 'base')
    await git(rootDirectoryId, 'worktree', 'add', '--quiet', '-b', 'feature/security', worktreePath)
    const repositoryIdentity = await loadGitRepositoryIdentity(rootDirectoryId)
    if (!repositoryIdentity.commonDirectoryIdentity) {
      throw new Error('Test filesystem does not expose a Git common-directory identity.')
    }
    gitCommonDirectoryIdentity = repositoryIdentity.commonDirectoryIdentity
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await rm(testDirectory, { recursive: true, force: true })
  })

  function metadata(branchName = 'feature/security'): StoredDirectoryWorktree {
    return {
      cwd: worktreePath,
      rootCwd: rootDirectoryId,
      branchName,
      parentBranchName: 'main',
      gitCommonDirectoryIdentity,
      isMain: false,
      source: 'howcode',
      completed: false,
    }
  }

  function rootMetadata(): StoredDirectoryWorktree {
    return {
      cwd: rootDirectoryId,
      rootCwd: rootDirectoryId,
      branchName: null,
      parentBranchName: null,
      gitCommonDirectoryIdentity,
      isMain: true,
      source: 'howcode',
      completed: false,
    }
  }

  it('removes only a live worktree that Git identifies as part of the project', async () => {
    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata()],
    })

    expect(result).toEqual({})
    await expect(access(rootDirectoryId)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(worktreePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('removes a validated Git root with no linked worktrees', async () => {
    await execFileAsync('git', ['worktree', 'remove', worktreePath], { cwd: rootDirectoryId })

    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: rootMetadata(),
      worktrees: [],
    })

    expect(result).toEqual({})
    await expect(access(rootDirectoryId)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves an unrelated directory recreated at a stale worktree path', async () => {
    await rm(worktreePath, { recursive: true, force: true })
    await mkdir(worktreePath)
    await execFileAsync('git', ['init', '-b', 'unrelated', '--quiet'], { cwd: worktreePath })
    const unrelatedFile = path.join(worktreePath, 'unrelated.txt')
    await writeFile(unrelatedFile, 'keep me\n')

    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata()],
    })

    expect(result).toHaveProperty('error')
    await expect(readFile(unrelatedFile, 'utf8')).resolves.toBe('keep me\n')
    await expect(access(rootDirectoryId)).resolves.toBeUndefined()
  })

  it('preserves the project when the persisted worktree branch no longer matches Git', async () => {
    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata('feature/other')],
    })

    expect(result).toHaveProperty('error')
    await expect(access(worktreePath)).resolves.toBeUndefined()
    await expect(access(rootDirectoryId)).resolves.toBeUndefined()
  })

  it('preserves a plain folder recreated at a saved Git project root', async () => {
    const savedRootMetadata = rootMetadata()
    await rm(worktreePath, { recursive: true, force: true })
    await rm(rootDirectoryId, { recursive: true, force: true })
    await mkdir(rootDirectoryId)
    const unrelatedFile = path.join(rootDirectoryId, 'unrelated.txt')
    await writeFile(unrelatedFile, 'keep me\n')

    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: savedRootMetadata,
      worktrees: [],
    })

    expect(result).toMatchObject({ error: expect.stringContaining(rootDirectoryId) })
    expect(result).toMatchObject({ error: expect.stringContaining('Pi only') })
    await expect(readFile(unrelatedFile, 'utf8')).resolves.toBe('keep me\n')
  })

  it('preserves a different Git repository recreated at the saved root path', async () => {
    const savedRootMetadata = rootMetadata()
    await rm(worktreePath, { recursive: true, force: true })
    await rm(rootDirectoryId, { recursive: true, force: true })
    await mkdir(rootDirectoryId)
    await execFileAsync('git', ['init', '-b', 'unrelated', '--quiet'], { cwd: rootDirectoryId })
    const unrelatedFile = path.join(rootDirectoryId, 'unrelated.txt')
    await writeFile(unrelatedFile, 'keep me\n')

    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: savedRootMetadata,
      worktrees: [],
    })

    expect(result).toMatchObject({ error: expect.stringContaining('identity no longer matches') })
    await expect(readFile(unrelatedFile, 'utf8')).resolves.toBe('keep me\n')
  })

  it('keeps full-clean removal for an ordinary non-Git project folder', async () => {
    await rm(worktreePath, { recursive: true, force: true })
    await rm(rootDirectoryId, { recursive: true, force: true })
    await mkdir(rootDirectoryId)
    await writeFile(path.join(rootDirectoryId, 'directory.txt'), 'delete me\n')

    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: null,
      worktrees: [],
    })

    expect(result).toEqual({})
    await expect(access(rootDirectoryId)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses a Git root when no repository provenance was saved', async () => {
    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: null,
      worktrees: [],
    })

    expect(result).toMatchObject({ error: expect.stringContaining(rootDirectoryId) })
    await expect(access(rootDirectoryId)).resolves.toBeUndefined()
  })

  it('preserves every directory when Git reports an unrecorded linked worktree', async () => {
    const unrecordedPath = path.join(testDirectory, 'unrecorded-worktree')
    await execFileAsync(
      'git',
      ['worktree', 'add', '--quiet', '-b', 'feature/unrecorded', unrecordedPath],
      { cwd: rootDirectoryId },
    )

    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata()],
    })

    expect(result).toMatchObject({ error: expect.stringContaining(unrecordedPath) })
    await expect(access(rootDirectoryId)).resolves.toBeUndefined()
    await expect(access(worktreePath)).resolves.toBeUndefined()
    await expect(access(unrecordedPath)).resolves.toBeUndefined()
  })

  it('preserves the root when an external worktree appears before final deletion', async () => {
    const newlyAddedPath = path.join(testDirectory, 'late-worktree')
    const loadGitWorktrees = gitWorktrees.loadGitWorktrees
    let loadCount = 0
    vi.spyOn(gitWorktrees, 'loadGitWorktrees').mockImplementation(async (directoryId) => {
      loadCount += 1
      if (loadCount === 2) {
        await execFileAsync(
          'git',
          ['worktree', 'add', '--quiet', '-b', 'feature/late', newlyAddedPath],
          { cwd: rootDirectoryId },
        )
      }
      return loadGitWorktrees(directoryId)
    })

    const result = await removeFullCleanDirectoryDirectories({
      rootDirectoryId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata()],
    })

    expect(result).toMatchObject({ error: expect.stringContaining(newlyAddedPath) })
    await expect(access(rootDirectoryId)).resolves.toBeUndefined()
    await expect(access(worktreePath)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(newlyAddedPath)).resolves.toBeUndefined()
  })
})
