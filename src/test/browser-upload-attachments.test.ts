import { mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanupBrowserUploadComposerAttachments,
  writeBrowserUploadComposerAttachments,
} from '../desktop-host/browser-upload-attachments'

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

  it('removes partial upload directories when a request fails', async () => {
    const rootDirectory = await createTempDirectory()
    await expect(
      writeBrowserUploadComposerAttachments(
        {
          files: [
            {
              name: 'kept-out.txt',
              dataBase64: Buffer.from('partial').toString('base64'),
            },
            {
              name: 'broken.txt',
            },
          ],
        },
        { rootDirectory },
      ),
    ).rejects.toThrow('missing data')

    await expect(readdir(rootDirectory)).resolves.toEqual([])
  })

  it('cleans upload temp entries older than fourteen days once per date', async () => {
    const rootDirectory = await createTempDirectory()
    const now = new Date('2026-06-11T12:00:00.000Z')
    const oldDate = new Date('2026-05-27T12:00:00.000Z')
    const freshDate = new Date('2026-05-30T12:00:00.000Z')
    const oldDirectory = path.join(rootDirectory, 'old-upload')
    const freshDirectory = path.join(rootDirectory, 'fresh-upload')
    const laterOldDirectory = path.join(rootDirectory, 'later-old-upload')

    await mkdir(oldDirectory)
    await writeFile(path.join(oldDirectory, 'old.txt'), 'old')
    await utimes(oldDirectory, oldDate, oldDate)

    await mkdir(freshDirectory)
    await writeFile(path.join(freshDirectory, 'fresh.txt'), 'fresh')
    await utimes(freshDirectory, freshDate, freshDate)

    await expect(
      cleanupBrowserUploadComposerAttachments({ rootDirectory, now }),
    ).resolves.toMatchObject({ removedEntries: 1, skipped: false })

    await expect(stat(oldDirectory)).rejects.toThrow()
    await expect(stat(freshDirectory)).resolves.toBeTruthy()

    await mkdir(laterOldDirectory)
    await writeFile(path.join(laterOldDirectory, 'old.txt'), 'old')
    await utimes(laterOldDirectory, oldDate, oldDate)

    await expect(
      cleanupBrowserUploadComposerAttachments({ rootDirectory, now }),
    ).resolves.toMatchObject({ removedEntries: 0, skipped: true })
    await expect(stat(laterOldDirectory)).resolves.toBeTruthy()
    await expect(readFile(path.join(rootDirectory, '.last-cleanup-date'), 'utf8')).resolves.toBe(
      '2026-06-11\n',
    )
  })
})
