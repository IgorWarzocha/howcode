import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const expectedTargets = [
  'linux-arm64',
  'linux-x64',
  'macos-arm64',
  'macos-x64',
  'win-arm64',
  'win-x64',
]
const semverPattern = /^\d+\.\d+\.\d+$/
const sha256Pattern = /^[a-f0-9]{64}$/i

async function sha256File(filePath: string) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

async function indexReleaseFiles(releaseDirectory: string) {
  const filesByName = new Map<string, string[]>()
  const pendingDirectories = [releaseDirectory]
  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop()
    if (!directory) continue
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath)
      } else if (entry.isFile()) {
        const paths = filesByName.get(entry.name) ?? []
        paths.push(entryPath)
        filesByName.set(entry.name, paths)
      }
    }
  }
  return filesByName
}

function requireUniqueFile(filesByName: ReadonlyMap<string, string[]>, fileName: string) {
  const matches = filesByName.get(fileName) ?? []
  if (matches.length === 0) throw new Error(`Missing ${fileName}`)
  if (matches.length > 1) throw new Error(`Duplicate release asset ${fileName}`)
  const [filePath] = matches
  if (!filePath) throw new Error(`Missing ${fileName}`)
  return filePath
}

export async function validateReleaseAssets(releaseDirectory: string, expectedChannel?: string) {
  const filesByName = await indexReleaseFiles(releaseDirectory)
  for (const target of expectedTargets) {
    const metadataName = `stable-${target}-update.json`
    const metadata = JSON.parse(
      await readFile(requireUniqueFile(filesByName, metadataName), 'utf8'),
    ) as {
      protocolVersion?: unknown
      channel?: unknown
      version?: unknown
      hash?: unknown
      assetUrl?: unknown
    }
    if (metadata.protocolVersion !== 2) throw new Error(`${metadataName} is not protocol v2`)
    if (expectedChannel && metadata.channel !== expectedChannel) {
      throw new Error(
        `${metadataName} has channel ${String(metadata.channel)}, expected ${expectedChannel}`,
      )
    }
    if (
      typeof metadata.version !== 'string' ||
      !semverPattern.test(metadata.version) ||
      typeof metadata.hash !== 'string' ||
      !sha256Pattern.test(metadata.hash) ||
      typeof metadata.assetUrl !== 'string'
    ) {
      throw new Error(`${metadataName} has invalid metadata fields`)
    }
    const assetName = path.basename(new URL(metadata.assetUrl).pathname)
    const expectedAssetName = `archive-howcode-${target}-${metadata.hash.toLowerCase()}.tar.gz`
    if (assetName !== expectedAssetName) {
      throw new Error(`${metadataName} points to ${assetName}, expected ${expectedAssetName}`)
    }
    const archivePath = requireUniqueFile(filesByName, assetName)
    const archiveHash = await sha256File(archivePath)
    if (archiveHash !== metadata.hash.toLowerCase()) {
      throw new Error(`${metadataName} hash does not match ${assetName}`)
    }
  }
  return expectedTargets.length
}
