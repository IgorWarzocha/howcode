import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { c as createTar } from 'tar'
import { afterEach, describe, expect, it } from 'vitest'
import { extractUpdateArchive } from './update-archive'

let temporaryRoot: string | null = null

afterEach(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
  temporaryRoot = null
})

describe('update archive extraction', () => {
  it('extracts an app.asar as an ordinary file', async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'howcode-update-archive-test-'))
    const sourceRoot = path.join(temporaryRoot, 'source')
    const resourcesPath = path.join(sourceRoot, 'howcode', 'resources')
    const destinationPath = path.join(temporaryRoot, 'destination')
    const archivePath = path.join(temporaryRoot, 'update.tar.gz')
    await mkdir(resourcesPath, { recursive: true })
    await mkdir(destinationPath)
    await writeFile(path.join(resourcesPath, 'app.asar'), 'packaged-app')
    await createTar({ cwd: sourceRoot, file: archivePath, gzip: true }, ['howcode'])

    await extractUpdateArchive(archivePath, destinationPath)

    await expect(
      readFile(path.join(destinationPath, 'howcode', 'resources', 'app.asar'), 'utf8'),
    ).resolves.toBe('packaged-app')
  })
})
