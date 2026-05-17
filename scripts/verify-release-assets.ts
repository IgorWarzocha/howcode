import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

type ReleaseTarget = {
  os: 'linux' | 'macos' | 'win'
  arch: 'arm64' | 'x64'
}

type StableUpdateMetadata = {
  version?: unknown
  hash?: unknown
  assetUrl?: unknown
}

const expectedTargets: ReleaseTarget[] = [
  { os: 'linux', arch: 'arm64' },
  { os: 'linux', arch: 'x64' },
  { os: 'macos', arch: 'arm64' },
  { os: 'macos', arch: 'x64' },
  { os: 'win', arch: 'arm64' },
  { os: 'win', arch: 'x64' },
]

const sha256Pattern = /^[a-f0-9]{64}$/
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

async function sha256File(filePath: string) {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

async function findFile(rootPath: string, fileName: string) {
  const stack = [rootPath]
  while (stack.length > 0) {
    const currentPath = stack.pop()
    if (!currentPath) continue

    for (const entry of await readdir(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
      } else if (entry.name === fileName) {
        return entryPath
      }
    }
  }
  return null
}

function parseMetadata(rawMetadata: string, metadataPath: string) {
  let metadata: StableUpdateMetadata
  try {
    metadata = JSON.parse(rawMetadata) as StableUpdateMetadata
  } catch (error) {
    throw new Error(
      `${metadataPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (typeof metadata.version !== 'string' || !semverPattern.test(metadata.version)) {
    throw new Error(`${metadataPath} has invalid version ${String(metadata.version)}`)
  }
  if (typeof metadata.hash !== 'string' || !sha256Pattern.test(metadata.hash)) {
    throw new Error(`${metadataPath} has invalid sha256 hash ${String(metadata.hash)}`)
  }
  if (metadata.assetUrl !== undefined && typeof metadata.assetUrl !== 'string') {
    throw new Error(`${metadataPath} has non-string assetUrl`)
  }

  return {
    version: metadata.version,
    hash: metadata.hash,
    assetUrl: metadata.assetUrl,
  }
}

async function assertReleaseAssetsRootExists(releaseAssetsRoot: string) {
  if (!(existsSync(releaseAssetsRoot) && (await stat(releaseAssetsRoot)).isDirectory())) {
    throw new Error(`Release assets directory does not exist: ${releaseAssetsRoot}`)
  }
}

async function verifyTargetAssets(
  releaseAssetsRoot: string,
  expectedVersion: string,
  target: ReleaseTarget,
) {
  const metadataName = `stable-${target.os}-${target.arch}-update.json`
  const metadataPath = await findFile(releaseAssetsRoot, metadataName)
  if (!metadataPath) throw new Error(`Missing ${metadataName}`)

  const metadata = parseMetadata(await readFile(metadataPath, 'utf8'), metadataPath)
  if (metadata.version !== expectedVersion) {
    throw new Error(
      `${metadataName} version ${metadata.version} does not match package.json ${expectedVersion}`,
    )
  }

  const assetName = metadata.assetUrl
    ? path.basename(new URL(metadata.assetUrl).pathname)
    : `howcode-${target.os}-${target.arch}.tar.gz`
  const archivePath = await findFile(releaseAssetsRoot, assetName)
  if (!archivePath) throw new Error(`${metadataName} points to missing archive ${assetName}`)

  const actualHash = await sha256File(archivePath)
  if (actualHash !== metadata.hash) {
    throw new Error(
      `${metadataName} hash ${metadata.hash} does not match ${assetName} sha256 ${actualHash}`,
    )
  }
}

async function verifyReleaseAssets() {
  const releaseAssetsRoot = process.argv[2] ?? path.join(process.cwd(), 'release-assets')
  const rootPackageJson = JSON.parse(
    await readFile(path.join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version?: unknown }
  const expectedVersion = rootPackageJson.version
  if (typeof expectedVersion !== 'string' || !semverPattern.test(expectedVersion)) {
    throw new Error(`package.json has invalid version ${String(expectedVersion)}`)
  }

  await assertReleaseAssetsRootExists(releaseAssetsRoot)

  for (const target of expectedTargets) {
    await verifyTargetAssets(releaseAssetsRoot, expectedVersion, target)
  }

  console.log(
    `Verified ${expectedTargets.length} stable update metadata files in ${releaseAssetsRoot}`,
  )
}

void verifyReleaseAssets().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
