import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateReleaseAssets } from '../../scripts/release-assets-validation'

const targets = ['linux-arm64', 'linux-x64', 'macos-arm64', 'macos-x64', 'win-arm64', 'win-x64']
const temporaryDirectories: string[] = []

async function createReleaseFixture() {
  const releaseDirectory = await mkdtemp(path.join(tmpdir(), 'howcode-release-assets-test-'))
  temporaryDirectories.push(releaseDirectory)
  const archiveDirectory = path.join(releaseDirectory, 'npm-launcher')
  await mkdir(archiveDirectory)
  const archives = new Map<string, string>()
  for (const target of targets) {
    const contents = Buffer.from(`archive:${target}`)
    const hash = createHash('sha256').update(contents).digest('hex')
    const assetName = `archive-howcode-${target}-${hash}.tar.gz`
    const archivePath = path.join(archiveDirectory, assetName)
    archives.set(target, archivePath)
    await writeFile(archivePath, contents)
    await writeFile(
      path.join(releaseDirectory, `stable-${target}-update.json`),
      JSON.stringify({
        protocolVersion: 2,
        channel: 'dev',
        version: '1.2.3',
        hash,
        assetUrl: `https://example.test/channel-dev/${assetName}`,
      }),
    )
  }
  return { archives, releaseDirectory }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('release asset validation', () => {
  it('finds nested launcher archives and rejects duplicate basenames', async () => {
    const { archives, releaseDirectory } = await createReleaseFixture()
    await expect(validateReleaseAssets(releaseDirectory, 'dev')).resolves.toBe(6)

    const linuxArchive = archives.get('linux-x64')
    if (!linuxArchive) throw new Error('Missing fixture archive')
    await copyFile(linuxArchive, path.join(releaseDirectory, path.basename(linuxArchive)))
    await expect(validateReleaseAssets(releaseDirectory, 'dev')).rejects.toThrow(
      'Duplicate release asset',
    )
  })
})
