import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { loadWorktreeSnapshot } from './worktree-snapshot.ts'

const run = promisify(execFile)
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

describe('worktree snapshot patch format', () => {
  it('emits canonical Git prefixes when mnemonic prefixes are configured', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'howcode-worktree-snapshot-test-'))
    temporaryDirectories.push(directory)
    const git = (...args: string[]) => run('git', args, { cwd: directory })

    await git('init', '--quiet')
    await git('config', 'user.email', 'test@howcode.local')
    await git('config', 'user.name', 'Howcode Test')
    await git('config', 'diff.mnemonicPrefix', 'true')
    await writeFile(join(directory, 'file.txt'), 'before\n')
    await git('add', 'file.txt')
    await git('commit', '--quiet', '-m', 'Initial')
    await writeFile(join(directory, 'file.txt'), 'after\n')

    for (const includeUntracked of [false, true]) {
      const streamedChunks: string[] = []
      const snapshot = await loadWorktreeSnapshot(directory, {
        includeUntracked,
        onPatchChunk: (chunk) => streamedChunks.push(chunk),
      })

      expect(snapshot.patch).toContain('diff --git a/file.txt b/file.txt')
      expect(snapshot.patch).toContain('--- a/file.txt')
      expect(snapshot.patch).toContain('+++ b/file.txt')
      expect(snapshot.patch).not.toContain('diff --git c/file.txt i/file.txt')
      expect(streamedChunks.join('').trim()).toBe(snapshot.patch)
    }
  })
})
