import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const notAttachedDirectoryErrorPattern = /not an attached folder/
const notAttachedFileErrorPattern = /not an attached file/

import { createAttachmentFileTools } from './attachment-file-tools.ts'

async function createFixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'howcode-attachment-tools-'))
  const attachedFile = path.join(cwd, 'attached.txt')
  const outsideFile = path.join(cwd, 'outside.txt')
  const attachedDir = path.join(cwd, 'folder')
  const nestedDir = path.join(attachedDir, 'nested-folder')
  await mkdir(attachedDir)
  await mkdir(nestedDir)
  await writeFile(attachedFile, 'attached file')
  await writeFile(outsideFile, 'outside file')
  await writeFile(path.join(attachedDir, 'nested.txt'), 'nested file')
  return { cwd, attachedFile, outsideFile, attachedDir, nestedDir }
}

function getTool(tools: ReturnType<typeof createAttachmentFileTools>['tools'], name: string) {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return tool
}

describe('attachment file tools', () => {
  it('rejects files that were not attached', async () => {
    const { cwd, attachedFile, outsideFile } = await createFixture()
    const { tools, access } = createAttachmentFileTools({ cwd, autoResizeImages: true })
    const read = getTool(tools, 'read')

    await access.grantAttachments([{ path: attachedFile, name: 'attached.txt', kind: 'text' }])
    await expect(
      read.execute('call', { path: outsideFile }, undefined, undefined, {
        cwd,
        model: { input: ['text'] },
      } as never),
    ).rejects.toThrow(notAttachedFileErrorPattern)
  })

  it('blocks directory overreach and symlink escapes', async () => {
    const { cwd, attachedFile, outsideFile, attachedDir, nestedDir } = await createFixture()
    await symlink(outsideFile, path.join(attachedDir, 'escape.txt'))
    const { tools, access } = createAttachmentFileTools({ cwd, autoResizeImages: true })
    const ls = getTool(tools, 'ls')
    const read = getTool(tools, 'read')

    await access.grantAttachments([
      { path: attachedFile, name: 'attached.txt', kind: 'text' },
      { path: attachedDir, name: 'folder', kind: 'directory' },
    ])

    await expect(
      ls.execute('call', { path: '.' }, undefined, undefined, { cwd } as never),
    ).rejects.toThrow(notAttachedDirectoryErrorPattern)
    await expect(
      ls.execute('call', { path: attachedFile }, undefined, undefined, { cwd } as never),
    ).rejects.toThrow(notAttachedDirectoryErrorPattern)
    await expect(
      ls.execute('call', { path: nestedDir }, undefined, undefined, { cwd } as never),
    ).rejects.toThrow(notAttachedDirectoryErrorPattern)
    await expect(
      read.execute('call', { path: path.join('folder', 'escape.txt') }, undefined, undefined, {
        cwd,
        model: { input: ['text'] },
      } as never),
    ).rejects.toThrow(notAttachedFileErrorPattern)
  })

  it('authorizes Pi-compatible read path variants', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'howcode-attachment-tools-'))
    const screenshotPath = path.join(cwd, 'Screenshot 1:00 PM.png')
    await writeFile(screenshotPath, 'screenshot text')
    const { tools, access } = createAttachmentFileTools({ cwd, autoResizeImages: true })
    const read = getTool(tools, 'read')

    await access.grantAttachments([{ path: screenshotPath, name: 'screenshot.png', kind: 'text' }])

    await expect(
      read.execute('call', { path: 'Screenshot 1:00 PM.png' }, undefined, undefined, {
        cwd,
        model: { input: ['text'] },
      } as never),
    ).resolves.toMatchObject({ content: [{ type: 'text', text: 'screenshot text' }] })
  })
})
