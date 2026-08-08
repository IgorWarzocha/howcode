import { execFile } from 'node:child_process'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { loadProjectDiffFileContents, maxProjectDiffTextFileBytes } from './file-content.ts'

const run = promisify(execFile)
const temporaryDirectories: string[] = []
const contentRevisionPattern = /^sha256:[a-f0-9]{64}$/

async function createRepository() {
  const directory = await mkdtemp(join(tmpdir(), 'howcode-file-content-test-'))
  temporaryDirectories.push(directory)
  const git = (...args: string[]) => run('git', args, { cwd: directory })

  await git('init', '--quiet')
  await git('config', 'user.email', 'test@howcode.local')
  await git('config', 'user.name', 'Howcode Test')
  await writeFile(join(directory, 'file.txt'), 'before\ncontext\n')
  await writeFile(join(directory, 'baseline-binary.dat'), Buffer.from([0xff, 0xfe, 0xfd]))
  await git('add', 'file.txt', 'baseline-binary.dat')
  await git('commit', '--quiet', '-m', 'Initial')
  const baselineRevision = (await git('rev-parse', 'HEAD')).stdout.trim()
  await writeFile(join(directory, 'file.txt'), 'after\ncontext\n')

  return { baselineRevision, directory }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

describe('project diff file contents', () => {
  it('loads complete baseline and worktree text with content revisions', async () => {
    const { baselineRevision, directory } = await createRepository()

    const result = await loadProjectDiffFileContents({
      projectId: directory,
      baselineRevision,
      oldPath: 'file.txt',
      newPath: 'file.txt',
    })

    expect(result).toMatchObject({
      kind: 'ready',
      oldFile: { path: 'file.txt', contents: 'before\ncontext\n' },
      newFile: { path: 'file.txt', contents: 'after\ncontext\n' },
    })
    if (result.kind !== 'ready') throw new Error('Expected file contents.')
    expect(result.oldFile?.revision).toMatch(contentRevisionPattern)
    expect(result.newFile.revision).toMatch(contentRevisionPattern)
    expect(result.oldFile?.revision).not.toBe(result.newFile.revision)
  })

  it('supports a new-side-only read for pure renames', async () => {
    const { baselineRevision, directory } = await createRepository()

    const result = await loadProjectDiffFileContents({
      projectId: directory,
      baselineRevision,
      oldPath: null,
      newPath: 'file.txt',
    })

    expect(result).toMatchObject({
      kind: 'ready',
      oldFile: null,
      newFile: { contents: 'after\ncontext\n' },
    })
  })

  it('rejects traversal and symlink escapes', async () => {
    const { baselineRevision, directory } = await createRepository()
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'howcode-outside-file-'))
    temporaryDirectories.push(outsideDirectory)
    const outsideFile = join(outsideDirectory, 'outside.txt')
    await writeFile(outsideFile, 'outside\n')
    await symlink(outsideFile, join(directory, 'escape.txt'))

    await expect(
      loadProjectDiffFileContents({
        projectId: directory,
        baselineRevision,
        oldPath: null,
        newPath: '../outside.txt',
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'invalid-path', side: 'new' },
    })
    await expect(
      loadProjectDiffFileContents({
        projectId: directory,
        baselineRevision,
        oldPath: null,
        newPath: 'escape.txt',
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'invalid-path', side: 'new' },
    })
  })

  it('reports missing, binary, and oversized worktree files', async () => {
    const { baselineRevision, directory } = await createRepository()

    await expect(
      loadProjectDiffFileContents({
        projectId: directory,
        baselineRevision,
        oldPath: null,
        newPath: 'missing.txt',
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'missing', side: 'new' },
    })
    await expect(
      loadProjectDiffFileContents({
        projectId: directory,
        baselineRevision,
        oldPath: 'missing.txt',
        newPath: 'file.txt',
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'missing', side: 'old' },
    })
    await expect(
      loadProjectDiffFileContents({
        projectId: directory,
        baselineRevision,
        oldPath: 'baseline-binary.dat',
        newPath: 'file.txt',
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'binary', side: 'old' },
    })

    await writeFile(join(directory, 'binary.dat'), Buffer.from([0xff, 0xfe, 0xfd]))
    await expect(
      loadProjectDiffFileContents({
        projectId: directory,
        baselineRevision,
        oldPath: null,
        newPath: 'binary.dat',
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'binary', side: 'new' },
    })

    await writeFile(join(directory, 'large.txt'), Buffer.alloc(maxProjectDiffTextFileBytes + 1))
    await expect(
      loadProjectDiffFileContents({
        projectId: directory,
        baselineRevision,
        oldPath: null,
        newPath: 'large.txt',
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: {
        kind: 'too-large',
        side: 'new',
        size: maxProjectDiffTextFileBytes + 1,
        maxBytes: maxProjectDiffTextFileBytes,
      },
    })
  })
})
