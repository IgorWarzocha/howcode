import { existsSync, readFileSync } from 'node:fs'
import { readdir, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { UpdateChannel } from './update-protocol'
import { isExecutableFile } from './update-transport'

export const APP_NAME = 'howcode'

export type UpdateTarget = {
  os: 'macos' | 'linux' | 'win'
  arch: 'arm64' | 'x64'
  executable: string
}

export type ReleaseInfo = {
  channel: UpdateChannel
  version: string
  hash: string
  assetUrl: string
}

export type InstalledUpdate = ReleaseInfo & {
  executablePath: string
  installDir: string
}

const sha256Pattern = /^[a-f0-9]{64}$/i
const semverPattern = /^\d+\.\d+\.\d+$/
const channelReleaseKeyPattern = /^(main|dev)-(\d+\.\d+\.\d+)-([a-f0-9]{64})$/i
const legacyReleaseKeyPattern = /^(\d+\.\d+\.\d+)-([a-f0-9]{64})$/i
const RECENT_VERSION_RETENTION = 5

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

export function getTarget(): UpdateTarget {
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : null
  if (!arch) throw new Error(`Unsupported architecture: ${process.arch}`)
  if (process.platform === 'darwin') {
    return { os: 'macos', arch, executable: `${APP_NAME}.app/Contents/MacOS/${APP_NAME}` }
  }
  if (process.platform === 'linux') {
    return { os: 'linux', arch, executable: `${APP_NAME}/${APP_NAME}` }
  }
  if (process.platform === 'win32') {
    return { os: 'win', arch, executable: `${APP_NAME}/${APP_NAME}.exe` }
  }
  throw new Error(`Unsupported platform: ${process.platform}`)
}

export function getCacheRoot() {
  const configuredCacheDirectory = getProcessEnvironmentVariable('HOWCODE_CACHE_DIR')
  if (configuredCacheDirectory) return configuredCacheDirectory
  if (process.platform === 'win32') {
    return path.join(
      getProcessEnvironmentVariable('LOCALAPPDATA') ?? path.join(homedir(), 'AppData', 'Local'),
      APP_NAME,
    )
  }
  if (process.platform === 'darwin') return path.join(homedir(), 'Library', 'Caches', APP_NAME)
  return path.join(
    getProcessEnvironmentVariable('XDG_CACHE_HOME') ?? path.join(homedir(), '.cache'),
    APP_NAME,
  )
}

export function getInstallPaths(target: UpdateTarget, release: ReleaseInfo) {
  const cacheRoot = getCacheRoot()
  const installDir = path.join(
    cacheRoot,
    'versions',
    `${release.channel}-${release.version}-${release.hash}`,
  )
  return {
    cacheRoot,
    currentFile: path.join(cacheRoot, `current-${release.channel}.json`),
    installDir,
    executablePath: path.join(installDir, target.executable),
  }
}

export function getLegacyInstallPaths(target: UpdateTarget, release: ReleaseInfo) {
  const cacheRoot = getCacheRoot()
  const installDir = path.join(cacheRoot, 'versions', `${release.version}-${release.hash}`)
  return {
    cacheRoot,
    currentFile: path.join(cacheRoot, 'current.json'),
    installDir,
    executablePath: path.join(installDir, target.executable),
  }
}

export function getAppResourcesPath(installDir: string, target: UpdateTarget) {
  if (target.os === 'macos')
    return path.join(installDir, `${APP_NAME}.app`, 'Contents', 'Resources')
  return path.join(installDir, APP_NAME, 'resources')
}

export function hasPackagedAppBundle(installDir: string, target: UpdateTarget) {
  const resourcesPath = getAppResourcesPath(installDir, target)
  return (
    existsSync(path.join(resourcesPath, 'app.asar')) ||
    existsSync(path.join(resourcesPath, 'app', 'package.json'))
  )
}

export async function isValidInstall(
  paths: ReturnType<typeof getInstallPaths>,
  target: UpdateTarget,
) {
  return (
    (await isExecutableFile(paths.executablePath)) && hasPackagedAppBundle(paths.installDir, target)
  )
}

export function parseInstalledUpdateRecord(
  record: unknown,
  fallbackChannel: UpdateChannel | null = null,
): InstalledUpdate | null {
  if (!record || typeof record !== 'object') return null
  const channel = 'channel' in record ? record.channel : fallbackChannel
  const version = 'version' in record ? record.version : null
  const hash = 'hash' in record ? record.hash : null
  const installDir = 'installDir' in record ? record.installDir : null
  const executablePath = 'executablePath' in record ? record.executablePath : null
  if (
    !(channel === 'main' || channel === 'dev') ||
    typeof version !== 'string' ||
    !semverPattern.test(version) ||
    typeof hash !== 'string' ||
    !sha256Pattern.test(hash) ||
    typeof installDir !== 'string' ||
    typeof executablePath !== 'string'
  ) {
    return null
  }
  return { channel, version, hash: hash.toLowerCase(), installDir, executablePath, assetUrl: '' }
}

export function readJsonIfPresent(filePath: string) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown
  } catch {
    return null
  }
}

export async function pruneOldVersions(cacheRoot: string, keepDirs: ReadonlySet<string>) {
  const versionsRoot = path.join(cacheRoot, 'versions')
  const runningVersionDir = getRunningCachedVersionDir(versionsRoot)
  let entries: Array<{ isDirectory(): boolean; name: string }>
  try {
    entries = await readdir(versionsRoot, { withFileTypes: true })
  } catch {
    return []
  }
  const versionDirs = await Promise.all(
    entries.flatMap((entry) =>
      entry.isDirectory()
        ? [
            (async () => {
              const dirPath = path.join(versionsRoot, entry.name)
              try {
                return { dirPath, modifiedAt: (await stat(dirPath)).mtimeMs }
              } catch {
                return null
              }
            })(),
          ]
        : [],
    ),
  ).then((directories) =>
    directories.filter(
      (directory): directory is { dirPath: string; modifiedAt: number } => directory !== null,
    ),
  )
  const retainedDirs = new Set(keepDirs)
  if (runningVersionDir) retainedDirs.add(runningVersionDir)
  versionDirs
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .slice(0, RECENT_VERSION_RETENTION)
    .forEach(({ dirPath }) => {
      retainedDirs.add(dirPath)
    })
  const removals = await Promise.allSettled(
    versionDirs.flatMap(({ dirPath }) =>
      retainedDirs.has(dirPath) ? [] : [rm(dirPath, { recursive: true, force: true })],
    ),
  )
  return removals.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []))
}

function getRunningCachedVersionDir(versionsRoot: string) {
  let currentPath = process.execPath
  while (currentPath !== path.dirname(currentPath)) {
    const parentPath = path.dirname(currentPath)
    if (parentPath === versionsRoot) return currentPath
    currentPath = parentPath
  }
  return null
}

export function getRunningReleaseFingerprint() {
  const runningVersionDir = getRunningCachedVersionDir(path.join(getCacheRoot(), 'versions'))
  if (!runningVersionDir) return null
  const runningReleaseKey = path.basename(runningVersionDir)
  const channelMatch = channelReleaseKeyPattern.exec(runningReleaseKey)
  if (channelMatch?.[2] && channelMatch[3]) {
    return { version: channelMatch[2], hash: channelMatch[3].toLowerCase() }
  }
  const legacyMatch = legacyReleaseKeyPattern.exec(runningReleaseKey)
  if (legacyMatch?.[1] && legacyMatch[2]) {
    return { version: legacyMatch[1], hash: legacyMatch[2].toLowerCase() }
  }
  return null
}
