import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateReleaseAssets } from '../../scripts/release-assets-validation'
import {
  channelRetention,
  compareVersions,
  newestChannelRetention,
  previousChannelArchives,
  rejectDowngrade,
  releaseNotes,
  requireSameReleaseCommit,
  rewriteManifestUrls,
} from '../../scripts/release-publication-policy'

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

  it('rejects a single stale manifest version before publication', async () => {
    const { releaseDirectory } = await createReleaseFixture()
    const file = path.join(releaseDirectory, 'stable-linux-x64-update.json')
    const manifest = JSON.parse(await readFile(file, 'utf8'))
    manifest.version = '1.2.2'
    await writeFile(file, JSON.stringify(manifest))
    await expect(validateReleaseAssets(releaseDirectory, 'dev', '1.2.3')).rejects.toThrow(
      'stable-linux-x64-update.json has version 1.2.2',
    )
  })

  it('retargets versioned manifests without changing archive bytes or hashes', async () => {
    const { releaseDirectory } = await createReleaseFixture()
    const channel = 'https://example.test/channel-dev'
    const versioned = 'https://example.test/v1.2.3'
    await validateReleaseAssets(releaseDirectory, 'dev', '1.2.3', channel)
    const file = path.join(releaseDirectory, 'stable-macos-arm64-update.json')
    const before = JSON.parse(await readFile(file, 'utf8'))
    await rewriteManifestUrls(releaseDirectory, channel, versioned)
    await validateReleaseAssets(releaseDirectory, 'dev', '1.2.3', versioned)
    const after = JSON.parse(await readFile(file, 'utf8'))
    expect(after.hash).toBe(before.hash)
    expect(after.assetUrl).toBe(before.assetUrl.replace(channel, versioned))
    await expect(validateReleaseAssets(releaseDirectory, 'dev', '1.2.3', channel)).rejects.toThrow(
      'does not point beneath',
    )
  })
})

describe('release publication policy', () => {
  it('keeps pre-interruption archives even after their manifests were replaced', () => {
    const commit = 'a'.repeat(40)
    const oldArchive = `archive-howcode-linux-x64-${'a'.repeat(64)}.tar.gz`
    const interruptedArchive = `archive-howcode-linux-x64-${'b'.repeat(64)}.tar.gz`
    const rebuiltArchive = `archive-howcode-linux-x64-${'c'.repeat(64)}.tar.gz`
    const laterArchive = `archive-howcode-linux-x64-${'d'.repeat(64)}.tar.gz`
    const started = channelRetention(commit, new Set([oldArchive]), new Set([interruptedArchive]))
    const retried = channelRetention(
      commit,
      new Set([interruptedArchive]),
      new Set([rebuiltArchive]),
      started,
    )
    expect(retried.previous).toEqual([oldArchive, interruptedArchive])
    const thirdAttempt = channelRetention(
      commit,
      new Set([rebuiltArchive]),
      new Set([laterArchive]),
      retried,
    )
    expect(thirdAttempt.previous).toEqual([oldArchive, rebuiltArchive])
    expect(newestChannelRetention([{ ...started, complete: true }, retried])).toEqual(retried)
    expect(newestChannelRetention([retried, { ...retried, complete: true }])?.complete).toBe(true)

    const completed = { ...retried, complete: true }
    const sameBuildRetry = channelRetention(
      commit,
      new Set([rebuiltArchive]),
      new Set([rebuiltArchive]),
      completed,
    )
    expect(sameBuildRetry.previous).toEqual([oldArchive, interruptedArchive])
    expect(
      channelRetention(commit, new Set([rebuiltArchive]), new Set([rebuiltArchive]), sameBuildRetry)
        .previous,
    ).toContain(oldArchive)
    const nextGeneration = channelRetention(
      'b'.repeat(40),
      new Set([rebuiltArchive]),
      new Set([laterArchive]),
      completed,
    )
    expect(nextGeneration.previous).toEqual([rebuiltArchive])
    const sameCommitRebuild = channelRetention(
      commit,
      new Set([rebuiltArchive]),
      new Set([laterArchive]),
      completed,
    )
    expect(sameCommitRebuild.previous).toEqual([rebuiltArchive])
  })

  it('allows a channel draft with no manifests yet', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'howcode-empty-channel-'))
    temporaryDirectories.push(directory)
    await expect(
      previousChannelArchives(directory, '1.2.3', 'https://example.test/channel-main'),
    ).resolves.toEqual(new Set())
  })

  it('recovers partially replaced manifests while retaining both advertised archives', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'howcode-partial-channel-'))
    temporaryDirectories.push(directory)
    const base = 'https://example.test/channel-main'
    const oldArchive = `archive-howcode-linux-x64-${'a'.repeat(64)}.tar.gz`
    const newArchive = `archive-howcode-win-x64-${'b'.repeat(64)}.tar.gz`
    await writeFile(
      path.join(directory, 'stable-linux-x64-update.json'),
      JSON.stringify({
        version: '1.2.2',
        assetUrl: `${base}/${oldArchive}`,
      }),
    )
    await writeFile(
      path.join(directory, 'stable-win-x64-update.json'),
      JSON.stringify({
        version: '1.2.3',
        assetUrl: `${base}/${newArchive}`,
      }),
    )
    await expect(previousChannelArchives(directory, '1.2.3', base)).resolves.toEqual(
      new Set([oldArchive, newArchive]),
    )
    await writeFile(
      path.join(directory, 'stable-win-x64-update.json'),
      JSON.stringify({
        version: '1.2.4',
        assetUrl: `${base}/${newArchive}`,
      }),
    )
    await expect(previousChannelArchives(directory, '1.2.3', base)).rejects.toThrow(
      'Refusing to downgrade',
    )
  })

  it('requires actual notes under the first heading matching the app version', () => {
    expect(releaseNotes('### 1.2.3\n\nFixed updates.\n\n### 1.2.2\nOld.', '1.2.3')).toBe(
      'Fixed updates.',
    )
    expect(() => releaseNotes('### 1.2.2\nOld.\n\n### 1.2.3\nNew.', '1.2.3')).toThrow(
      'First changelog section',
    )
    expect(() => releaseNotes('### 1.2.3\n\n### 1.2.2\nOld.', '1.2.3')).toThrow(
      'First changelog section',
    )
  })

  it('rejects different commits and older channel/latest candidates', () => {
    expect(() => requireSameReleaseCommit('original', 'rebuild')).toThrow('Release belongs to')
    expect(() => requireSameReleaseCommit('original', 'original')).not.toThrow()
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.9.9', '1.10.0')).toBe(-1)
    expect(() => rejectDowngrade('1.10.0', '1.9.9', 'channel-main')).toThrow(
      'Refusing to downgrade channel-main',
    )
  })
})
