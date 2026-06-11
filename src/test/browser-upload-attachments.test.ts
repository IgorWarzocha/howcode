import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeBrowserUploadComposerAttachments } from '../desktop-host/browser-upload-attachments'

let tempDirectories: string[] = []

async function createTempDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-upload-test-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  )
  tempDirectories = []
})

describe('browser upload attachments', () => {
  it('writes uploaded files to a private temp directory', async () => {
    const rootDirectory = await createTempDirectory()
    const attachments = await writeBrowserUploadComposerAttachments(
      {
        files: [
          {
            name: '../pasted-image',
            type: 'image/png',
            dataBase64: Buffer.from('image-data').toString('base64'),
          },
        ],
      },
      { rootDirectory },
    )

    expect(attachments).toHaveLength(1)
    expect(attachments[0]).toMatchObject({ name: 'pasted-image.png', kind: 'image' })
    expect(attachments[0]?.path.startsWith(rootDirectory)).toBe(true)
    await expect(readFile(attachments[0]?.path ?? '', 'utf8')).resolves.toBe('image-data')
  })

  it('rejects files over the upload limit', async () => {
    const rootDirectory = await createTempDirectory()
    await expect(
      writeBrowserUploadComposerAttachments(
        {
          files: [
            {
              name: 'too-large.txt',
              dataBase64: Buffer.alloc(51 * 1024 * 1024).toString('base64'),
            },
          ],
        },
        { rootDirectory },
      ),
    ).rejects.toThrow('too large')
  })
})
