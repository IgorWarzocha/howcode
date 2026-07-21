import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const releaseDirectory = process.argv[2]
if (!releaseDirectory) throw new Error('Usage: bun scripts/validate-release-assets.ts <directory>')

const expectedTargets = [
  'linux-arm64',
  'linux-x64',
  'macos-arm64',
  'macos-x64',
  'win-arm64',
  'win-x64',
]
const files = new Set(await readdir(releaseDirectory))
// biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
const expectedChannel = process.env['HOWCODE_RELEASE_CHANNEL']

async function sha256File(filePath: string) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

for (const target of expectedTargets) {
  const metadataName = `stable-${target}-update.json`
  if (!files.has(metadataName)) throw new Error(`Missing ${metadataName}`)
  const metadata = JSON.parse(
    await readFile(path.join(releaseDirectory, metadataName), 'utf8'),
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
    !/^\d+\.\d+\.\d+$/.test(metadata.version) ||
    typeof metadata.hash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(metadata.hash) ||
    typeof metadata.assetUrl !== 'string'
  ) {
    throw new Error(`${metadataName} has invalid metadata fields`)
  }
  const assetName = path.basename(new URL(metadata.assetUrl).pathname)
  const expectedAssetName = `archive-howcode-${target}-${metadata.hash.toLowerCase()}.tar.gz`
  if (assetName !== expectedAssetName) {
    throw new Error(`${metadataName} points to ${assetName}, expected ${expectedAssetName}`)
  }
  if (!files.has(assetName)) throw new Error(`${metadataName} points to missing ${assetName}`)
  const archiveHash = await sha256File(path.join(releaseDirectory, assetName))
  if (archiveHash !== metadata.hash.toLowerCase()) {
    throw new Error(`${metadataName} hash does not match ${assetName}`)
  }
}

console.log(`Validated ${expectedTargets.length} release manifests in ${releaseDirectory}`)
