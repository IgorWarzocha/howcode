import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { authorizeAttachmentPath, resolveAttachmentGrants } from './attachment-grants.ts'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})
async function fixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'howcode-grants-'))
  directories.push(cwd)
  const folder = path.join(cwd, 'folder')
  await mkdir(folder)
  await mkdir(path.join(folder, 'nested'))
  await writeFile(path.join(cwd, 'outside.txt'), 'private')
  await writeFile(path.join(folder, 'allowed.txt'), 'allowed')
  const grants = await resolveAttachmentGrants([
    { path: folder, kind: 'directory', name: 'folder' },
  ])
  return { cwd, folder, grants }
}

describe('chat attachment grants', () => {
  it('blocks sibling paths, traversal, and symlinks outside a granted folder', async () => {
    const { cwd, folder, grants } = await fixture()
    await symlink(path.join(cwd, 'outside.txt'), path.join(folder, 'escape.txt'))
    for (const requested of ['outside.txt', 'folder/../outside.txt', 'folder/escape.txt']) {
      await expect(authorizeAttachmentPath(requested, cwd, grants)).rejects.toThrow(
        'not an attached file',
      )
    }
    expect(await authorizeAttachmentPath('folder/allowed.txt', cwd, grants)).toBe(
      path.join(folder, 'allowed.txt'),
    )
    await expect(authorizeAttachmentPath('folder/nested', cwd, grants, true)).rejects.toThrow(
      'not an attached folder',
    )
  })

  it('resolves supported filename variants before authorization', async () => {
    const { cwd } = await fixture()
    const filePath = path.join(cwd, 'Screenshot 1:00\u202FPM.png')
    await writeFile(filePath, 'data')
    const grants = await resolveAttachmentGrants([
      { path: filePath, kind: 'text', name: 'screenshot' },
    ])
    expect(await authorizeAttachmentPath('Screenshot 1:00 PM.png', cwd, grants)).toBe(filePath)
    await expect(authorizeAttachmentPath('.', cwd, grants, true)).rejects.toThrow(
      'not an attached folder',
    )
  })
})
