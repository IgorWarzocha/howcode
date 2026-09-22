import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGitRepositoryIdentity } from '../project-git/repository-identity.ts'
import * as gitWorktrees from '../project-git/worktrees.ts'
import type { StoredProjectWorktree } from '../thread-state-db.ts'
import { removeFullCleanProjectDirectories } from './full-clean-removal.ts'

const execFileAsync = promisify(execFile)

describe('full-clean project directory removal', () => {
  let testDirectory: string
  let rootProjectId: string
  let worktreePath: string
  let gitCommonDirectoryIdentity: string

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
    const repositoryIdentity = await loadGitRepositoryIdentity(rootProjectId)
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

  function metadata(branchName = 'feature/security'): StoredProjectWorktree {
    return {
      cwd: worktreePath,
      rootCwd: rootProjectId,
      branchName,
      parentBranchName: 'main',
      gitCommonDirectoryIdentity,
      isMain: false,
      source: 'howcode',
      completed: false,
    }
  }

  function rootMetadata(): StoredProjectWorktree {
    return {
      cwd: rootProjectId,
      rootCwd: rootProjectId,
      branchName: null,
      parentBranchName: null,
      gitCommonDirectoryIdentity,
      isMain: true,
      source: 'howcode',
      completed: false,
    }
  }

  it('removes only a live worktree that Git identifies as part of the project', async () => {
    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata()],
    })

    expect(result).toEqual({})
    await expect(access(rootProjectId)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(worktreePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('removes a validated Git root with no linked worktrees', async () => {
    await execFileAsync('git', ['worktree', 'remove', worktreePath], { cwd: rootProjectId })

    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: rootMetadata(),
      worktrees: [],
    })

    expect(result).toEqual({})
    await expect(access(rootProjectId)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves an unrelated directory recreated at a stale worktree path', async () => {
    await rm(worktreePath, { recursive: true, force: true })
    await mkdir(worktreePath)
    await execFileAsync('git', ['init', '-b', 'unrelated', '--quiet'], { cwd: worktreePath })
    const unrelatedFile = path.join(worktreePath, 'unrelated.txt')
    await writeFile(unrelatedFile, 'keep me\n')

    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata()],
    })

    expect(result).toHaveProperty('error')
    await expect(readFile(unrelatedFile, 'utf8')).resolves.toBe('keep me\n')
    await expect(access(rootProjectId)).resolves.toBeUndefined()
  })

  it('preserves the project when the persisted worktree branch no longer matches Git', async () => {
    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata('feature/other')],
    })

    expect(result).toHaveProperty('error')
    await expect(access(worktreePath)).resolves.toBeUndefined()
    await expect(access(rootProjectId)).resolves.toBeUndefined()
  })

  it('preserves a plain folder recreated at a saved Git project root', async () => {
    const savedRootMetadata = rootMetadata()
    await rm(worktreePath, { recursive: true, force: true })
    await rm(rootProjectId, { recursive: true, force: true })
    await mkdir(rootProjectId)
    const unrelatedFile = path.join(rootProjectId, 'unrelated.txt')
    await writeFile(unrelatedFile, 'keep me\n')

    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: savedRootMetadata,
      worktrees: [],
    })

    expect(result).toMatchObject({ error: expect.stringContaining(rootProjectId) })
    expect(result).toMatchObject({ error: expect.stringContaining('Pi only') })
    await expect(readFile(unrelatedFile, 'utf8')).resolves.toBe('keep me\n')
  })

  it('preserves a different Git repository recreated at the saved root path', async () => {
    const savedRootMetadata = rootMetadata()
    await rm(worktreePath, { recursive: true, force: true })
    await rm(rootProjectId, { recursive: true, force: true })
    await mkdir(rootProjectId)
    await execFileAsync('git', ['init', '-b', 'unrelated', '--quiet'], { cwd: rootProjectId })
    const unrelatedFile = path.join(rootProjectId, 'unrelated.txt')
    await writeFile(unrelatedFile, 'keep me\n')

    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: savedRootMetadata,
      worktrees: [],
    })

    expect(result).toMatchObject({ error: expect.stringContaining('identity no longer matches') })
    await expect(readFile(unrelatedFile, 'utf8')).resolves.toBe('keep me\n')
  })

  it('keeps full-clean removal for an ordinary non-Git project folder', async () => {
    await rm(worktreePath, { recursive: true, force: true })
    await rm(rootProjectId, { recursive: true, force: true })
    await mkdir(rootProjectId)
    await writeFile(path.join(rootProjectId, 'project.txt'), 'delete me\n')

    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: null,
      worktrees: [],
    })

    expect(result).toEqual({})
    await expect(access(rootProjectId)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses a Git root when no repository provenance was saved', async () => {
    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: null,
      worktrees: [],
    })

    expect(result).toMatchObject({ error: expect.stringContaining(rootProjectId) })
    await expect(access(rootProjectId)).resolves.toBeUndefined()
  })

  it('preserves every directory when Git reports an unrecorded linked worktree', async () => {
    const unrecordedPath = path.join(testDirectory, 'unrecorded-worktree')
    await execFileAsync(
      'git',
      ['worktree', 'add', '--quiet', '-b', 'feature/unrecorded', unrecordedPath],
      { cwd: rootProjectId },
    )

    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata()],
    })

    expect(result).toMatchObject({ error: expect.stringContaining(unrecordedPath) })
    await expect(access(rootProjectId)).resolves.toBeUndefined()
    await expect(access(worktreePath)).resolves.toBeUndefined()
    await expect(access(unrecordedPath)).resolves.toBeUndefined()
  })

  it('preserves the root when an external worktree appears before final deletion', async () => {
    const newlyAddedPath = path.join(testDirectory, 'late-worktree')
    const loadGitWorktrees = gitWorktrees.loadGitWorktrees
    let loadCount = 0
    vi.spyOn(gitWorktrees, 'loadGitWorktrees').mockImplementation(async (projectId) => {
      loadCount += 1
      if (loadCount === 2) {
        await execFileAsync(
          'git',
          ['worktree', 'add', '--quiet', '-b', 'feature/late', newlyAddedPath],
          { cwd: rootProjectId },
        )
      }
      return loadGitWorktrees(projectId)
    })

    const result = await removeFullCleanProjectDirectories({
      rootProjectId,
      rootWorktree: rootMetadata(),
      worktrees: [metadata()],
    })

    expect(result).toMatchObject({ error: expect.stringContaining(newlyAddedPath) })
    await expect(access(rootProjectId)).resolves.toBeUndefined()
    await expect(access(worktreePath)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(newlyAddedPath)).resolves.toBeUndefined()
  })
})
