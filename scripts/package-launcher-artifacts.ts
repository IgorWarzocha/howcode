const windowsUnpackedDirectoryPattern = /win.*unpacked$/i
const linuxUnpackedDirectoryPattern = /linux.*unpacked$/i

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { copyFile, cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

const appName = 'howcode'
const require = createRequire(import.meta.url)
const {
  nativeServiceAbiDirectoryName,
  serviceNativePackages,
  supportedServiceNodeAbis,
  validateAbiBundle,
} = require('./service-native-abi.cjs') as {
  supportedServiceNodeAbis: string[]
  serviceNativePackages: string[]
  nativeServiceAbiDirectoryName: string
  validateAbiBundle: (resourcesPath: string, abi: string) => void
}

const electronOutputRoot = path.join(process.cwd(), 'artifacts', 'electron')
const artifactRoot = path.join(process.cwd(), 'artifacts')
const launcherOutputRoot = path.join(artifactRoot, 'npm-launcher')

const requiredUnpackedRuntimePaths = [
  path.join('build', 'desktop', 'service-host.mjs'),
  path.join('node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  path.join('node_modules', 'node-pty', 'build', 'Release', 'pty.node'),
]

type Target = {
  os: 'macos' | 'linux' | 'win'
  arch: 'arm64' | 'x64'
}

function getCurrentTarget(): Target {
  if (process.platform === 'darwin') {
    return { os: 'macos', arch: process.arch === 'arm64' ? 'arm64' : 'x64' }
  }

  if (process.platform === 'win32') {
    return { os: 'win', arch: process.arch === 'arm64' ? 'arm64' : 'x64' }
  }

  return { os: 'linux', arch: process.arch === 'arm64' ? 'arm64' : 'x64' }
}

async function findPaths(rootPath: string, matcher: (entryPath: string) => boolean) {
  const stack = [rootPath]
  const matches: string[] = []

  while (stack.length > 0) {
    const currentPath = stack.pop()
    if (!currentPath) {
      continue
    }

    const entries = await readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)
      if (matcher(entryPath)) {
        matches.push(entryPath)
      }

      if (entry.isDirectory()) {
        stack.push(entryPath)
      }
    }
  }

  return matches
}

function getPreferredBundlePathCandidates(target: Target) {
  if (target.os === 'macos') {
    return [
      path.join(electronOutputRoot, `mac-${target.arch}`, `${appName}.app`),
      path.join(electronOutputRoot, 'mac', `${appName}.app`),
      path.join(electronOutputRoot, `${appName}.app`),
    ]
  }

  if (target.os === 'win') {
    return [
      path.join(electronOutputRoot, `win-${target.arch}-unpacked`),
      path.join(electronOutputRoot, 'win-unpacked'),
    ]
  }

  return [
    path.join(electronOutputRoot, `linux-${target.arch}-unpacked`),
    path.join(electronOutputRoot, 'linux-unpacked'),
  ]
}

async function sortPathsByModifiedTime(paths: string[]) {
  const pathsWithMetadata = await Promise.all(
    paths.map(async (entryPath) => ({ entryPath, modifiedAtMs: (await stat(entryPath)).mtimeMs })),
  )

  return pathsWithMetadata
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
    .map(({ entryPath }) => entryPath)
}

async function resolveBundlePath(target: Target) {
  if (!existsSync(electronOutputRoot)) {
    throw new Error('Missing Electron output. Run `bun run build:release` first.')
  }

  const preferredBundleCandidates = getPreferredBundlePathCandidates(target).filter((entryPath) =>
    existsSync(entryPath),
  )
  if (preferredBundleCandidates.length > 0) {
    const [preferredBundlePath] = await sortPathsByModifiedTime(preferredBundleCandidates)
    if (preferredBundlePath) {
      return preferredBundlePath
    }
  }

  const matches = await findPaths(electronOutputRoot, (entryPath) => {
    const normalized = entryPath.replace(/\\/g, '/')
    if (target.os === 'macos') {
      return normalized.endsWith(`/${appName}.app`)
    }

    if (target.os === 'win') {
      return windowsUnpackedDirectoryPattern.test(path.basename(entryPath))
    }

    return linuxUnpackedDirectoryPattern.test(path.basename(entryPath))
  })

  const [bundlePath] = await sortPathsByModifiedTime(matches)
  if (!bundlePath) {
    throw new Error(`Could not find unpacked Electron bundle in ${electronOutputRoot}.`)
  }

  return bundlePath
}

async function createNormalizedArchive(bundlePath: string, target: Target) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), `${appName}-${target.os}-${target.arch}-`))
  const normalizedBundleName = target.os === 'macos' ? `${appName}.app` : appName
  const normalizedBundlePath = path.join(tempRoot, normalizedBundleName)
  const archivePath = path.join(launcherOutputRoot, `${appName}-${target.os}-${target.arch}.tar.gz`)

  await cp(bundlePath, normalizedBundlePath, { recursive: true })

  const resourcesPath =
    target.os === 'macos'
      ? path.join(normalizedBundlePath, 'Contents', 'Resources')
      : path.join(normalizedBundlePath, 'resources')
  if (
    !(
      existsSync(path.join(resourcesPath, 'app.asar')) ||
      existsSync(path.join(resourcesPath, 'app', 'package.json'))
    )
  ) {
    throw new Error(`Packaged Electron bundle is missing app.asar/app in ${resourcesPath}.`)
  }

  const unpackedRoot = path.join(resourcesPath, 'app.asar.unpacked')
  const missingUnpackedRuntimePaths = requiredUnpackedRuntimePaths.filter(
    (relativePath) => !existsSync(path.join(unpackedRoot, relativePath)),
  )
  if (missingUnpackedRuntimePaths.length > 0) {
    throw new Error(
      `Packaged Electron bundle is missing unpacked runtime dependencies: ${missingUnpackedRuntimePaths.join(', ')}.`,
    )
  }

  validateUnpackedNativeRuntimeBundles(unpackedRoot)

  const tarResult = spawnSync('tar', ['-czf', archivePath, '-C', tempRoot, normalizedBundleName], {
    stdio: 'inherit',
  })

  await rm(tempRoot, { recursive: true, force: true })

  if (tarResult.status !== 0) {
    throw new Error(`Failed to package launcher archive for ${target.os}-${target.arch}.`)
  }

  return archivePath
}

function validateUnpackedNativeRuntimeBundles(unpackedRoot: string) {
  const resourcesPath = path.dirname(unpackedRoot)
  for (const abi of supportedServiceNodeAbis) {
    validateAbiBundle(resourcesPath, abi)
  }

  const currentAbi = process.versions.modules
  if (!supportedServiceNodeAbis.includes(currentAbi)) return

  const currentAbiNodeModulesPath = path.join(
    unpackedRoot,
    nativeServiceAbiDirectoryName,
    currentAbi,
    'node_modules',
  )
  const currentAbiRoot = path.dirname(currentAbiNodeModulesPath)
  const fallbackNodeModulesPath = path.join(unpackedRoot, 'node_modules')
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `for (const packageName of ${JSON.stringify(serviceNativePackages)}) require(packageName)`,
    ],
    {
      cwd: currentAbiRoot,
      env: {
        ...process.env,
        NODE_PATH: [currentAbiNodeModulesPath, fallbackNodeModulesPath].join(path.delimiter),
      },
      encoding: 'utf8',
    },
  )

  if (result.status !== 0) {
    throw new Error(
      [
        `Packaged native service dependency bundle for ABI ${currentAbi} does not load under ${process.version}.`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

async function createUpdateMetadata(archivePath: string, target: Target, version: string) {
  const archiveBuffer = await readFile(archivePath)
  const hash = createHash('sha256').update(archiveBuffer).digest('hex')
  const metadataPath = path.join(artifactRoot, `stable-${target.os}-${target.arch}-update.json`)
  const immutableArchivePath = path.join(
    path.dirname(archivePath),
    `archive-${appName}-${target.os}-${target.arch}-${hash}.tar.gz`,
  )
  await copyFile(archivePath, immutableArchivePath)
  const { HOWCODE_RELEASE_ASSET_BASE_URL: assetBaseUrl } = process.env

  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        version,
        hash,
        assetUrl: assetBaseUrl
          ? `${assetBaseUrl}/${path.basename(immutableArchivePath)}`
          : undefined,
      },
      null,
      2,
    ),
  )

  return immutableArchivePath
}

async function main() {
  const packageJson = JSON.parse(
    await readFile(path.join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
  mkdirSync(launcherOutputRoot, { recursive: true })
  const target = getCurrentTarget()
  const bundlePath = await resolveBundlePath(target)
  const archivePath = await createNormalizedArchive(bundlePath, target)
  const immutableArchivePath = await createUpdateMetadata(archivePath, target, packageJson.version)
  console.log(`created ${path.relative(process.cwd(), immutableArchivePath)}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
