import { mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanupBrowserUploadComposerAttachments,
  writeBrowserUploadComposerAttachmentsFromMultipart,
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

function createMultipartUpload(
  boundary: string,
  files: Array<{ name: string; type?: string | undefined; data: Buffer | string }>,
) {
  const chunks: Buffer[] = []
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.name}"\r\n${file.type ? `Content-Type: ${file.type}\r\n` : ''}\r\n`,
      ),
      Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data),
      Buffer.from('\r\n'),
    )
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return Buffer.concat(chunks)
}

async function writeMultipartUpload(
  rootDirectory: string,
  files: Array<{ name: string; type?: string | undefined; data: Buffer | string }>,
) {
  const boundary = 'howcode-test-boundary'
  return writeBrowserUploadComposerAttachmentsFromMultipart(
    [createMultipartUpload(boundary, files)],
    `multipart/form-data; boundary=${boundary}`,
    { rootDirectory },
  )
}

function chunkBuffer(buffer: Buffer, size: number) {
  const chunks: Buffer[] = []
  for (let index = 0; index < buffer.length; index += size) {
    chunks.push(buffer.subarray(index, index + size))
  }
  return chunks
}

describe('browser upload attachments', () => {
  it('streams multipart uploaded files to a private temp directory', async () => {
    const rootDirectory = await createTempDirectory()
    const attachments = await writeMultipartUpload(rootDirectory, [
      {
        name: '../pasted-image',
        type: 'image/png',
        data: 'image-data',
      },
    ])

    expect(attachments).toHaveLength(1)
    expect(attachments[0]).toMatchObject({ name: 'pasted-image.png', kind: 'image' })
    expect(attachments[0]?.path.startsWith(rootDirectory)).toBe(true)
    await expect(readFile(attachments[0]?.path ?? '', 'utf8')).resolves.toBe('image-data')
  })

  it('handles multipart boundaries split across request chunks', async () => {
    const rootDirectory = await createTempDirectory()
    const boundary = 'howcode-test-boundary'
    const body = createMultipartUpload(boundary, [
      {
        name: 'chunked.txt',
        type: 'text/plain',
        data: 'chunked-data',
      },
    ])

    const attachments = await writeBrowserUploadComposerAttachmentsFromMultipart(
      chunkBuffer(body, 5),
      `multipart/form-data; boundary=${boundary}`,
      { rootDirectory },
    )

    expect(attachments).toHaveLength(1)
    await expect(readFile(attachments[0]?.path ?? '', 'utf8')).resolves.toBe('chunked-data')
  })

  it('rejects files over the upload limit', async () => {
    const rootDirectory = await createTempDirectory()
    await expect(
      writeMultipartUpload(rootDirectory, [
        {
          name: 'too-large.txt',
          data: Buffer.alloc(51 * 1024 * 1024),
        },
      ]),
    ).rejects.toThrow('too large')
  })

  it('removes partial upload directories when a request fails', async () => {
    const rootDirectory = await createTempDirectory()
    await expect(
      writeMultipartUpload(rootDirectory, [
        {
          name: 'kept-out.txt',
          data: 'partial',
        },
        {
          name: 'broken.txt',
          data: '',
        },
      ]),
    ).rejects.toThrow('empty')

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
