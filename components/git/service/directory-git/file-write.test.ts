import { execFile } from 'node:child_process'
import { chmod, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { maxDirectoryDiffTextFileBytes } from '@howaboua/pi-durable-git/native'
import { afterEach, describe, expect, it } from 'vitest'
import { writeDirectoryTextFile } from './file-write.ts'
import { loadDirectoryDiffFileContents } from './native-reader.ts'

const run = promisify(execFile)
const temporaryDirectories: string[] = []

async function createRepository() {
  const directory = await mkdtemp(join(tmpdir(), 'howcode-file-write-test-'))
  temporaryDirectories.push(directory)
  const git = (...args: string[]) => run('git', args, { cwd: directory })

  await git('init', '--quiet')
  await git('config', 'user.email', 'test@howcode.local')
  await git('config', 'user.name', 'Howcode Test')
  await writeFile(join(directory, 'file.txt'), 'before\n')
  await chmod(join(directory, 'file.txt'), 0o744)
  await git('add', 'file.txt')
  await git('commit', '--quiet', '-m', 'Initial')
  const baselineRevision = (await git('rev-parse', 'HEAD')).stdout.trim()
  const loaded = await loadDirectoryDiffFileContents({
    directoryId: directory,
    baselineRevision,
    oldPath: 'file.txt',
    newPath: 'file.txt',
  })
  if (loaded.kind !== 'ready') throw new Error('Expected file contents.')

  return { directory, revision: loaded.newFile.revision }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

describe('directory text file writes', () => {
  it('writes atomically with the expected revision and preserves the file mode', async () => {
    const { directory, revision } = await createRepository()

    const result = await writeDirectoryTextFile({
      directoryId: directory,
      path: 'file.txt',
      contents: 'after\n',
      expectedRevision: revision,
    })

    expect(result).toMatchObject({
      kind: 'written',
      file: { path: 'file.txt', contents: 'after\n' },
    })
    expect(await readFile(join(directory, 'file.txt'), 'utf8')).toBe('after\n')
    expect((await stat(join(directory, 'file.txt'))).mode & 0o777).toBe(0o744)
    expect((await readdir(directory)).some((name) => name.startsWith('.howcode-'))).toBe(false)
  })

  it('keeps the external version when the expected revision is stale', async () => {
    const { directory, revision } = await createRepository()
    await writeFile(join(directory, 'file.txt'), 'external\n')

    const result = await writeDirectoryTextFile({
      directoryId: directory,
      path: 'file.txt',
      contents: 'editor\n',
      expectedRevision: revision,
    })

    expect(result).toMatchObject({
      kind: 'conflict',
      path: 'file.txt',
      expectedRevision: revision,
    })
    expect(await readFile(join(directory, 'file.txt'), 'utf8')).toBe('external\n')
  })

  it('serializes competing writes so only one matching revision wins', async () => {
    const { directory, revision } = await createRepository()

    const results = await Promise.all([
      writeDirectoryTextFile({
        directoryId: directory,
        path: 'file.txt',
        contents: 'first\n',
        expectedRevision: revision,
      }),
      writeDirectoryTextFile({
        directoryId: directory,
        path: 'file.txt',
        contents: 'second\n',
        expectedRevision: revision,
      }),
    ])

    expect(results.map((result) => result.kind).sort()).toEqual(['conflict', 'written'])
    expect(['first\n', 'second\n']).toContain(await readFile(join(directory, 'file.txt'), 'utf8'))
  })

  it('rejects unsafe paths, symlinks, and oversized editor contents', async () => {
    const { directory, revision } = await createRepository()
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'howcode-file-write-outside-'))
    temporaryDirectories.push(outsideDirectory)
    const outsideFile = join(outsideDirectory, 'outside.txt')
    await writeFile(outsideFile, 'outside\n')
    await symlink(outsideFile, join(directory, 'escape.txt'))

    await expect(
      writeDirectoryTextFile({
        directoryId: directory,
        path: '../outside.txt',
        contents: 'nope\n',
        expectedRevision: revision,
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'invalid-path' },
    })
    await expect(
      writeDirectoryTextFile({
        directoryId: directory,
        path: 'escape.txt',
        contents: 'nope\n',
        expectedRevision: revision,
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'invalid-path' },
    })
    await expect(
      writeDirectoryTextFile({
        directoryId: directory,
        path: 'file.txt',
        contents: 'x'.repeat(maxDirectoryDiffTextFileBytes + 1),
        expectedRevision: revision,
      }),
    ).resolves.toMatchObject({
      kind: 'unavailable',
      issue: { kind: 'too-large', size: maxDirectoryDiffTextFileBytes + 1 },
    })
  })
})
