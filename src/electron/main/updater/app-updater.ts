import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { app } from 'electron'
import { x as extractTar } from 'tar'
import packageJson from '../../../../package.json'
import type { AppUpdateState } from '../../../../shared/desktop-app-update-contracts'
import { getAppRootPath } from '../runtime/app-paths'
import { spawnDetached } from './spawn-detached'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const APP_NAME = 'howcode'
const DEFAULT_RELEASE_BASE_URL = 'https://github.com/IgorWarzocha/howcode/releases/latest/download'
const RELEASE_BASE_URL =
  getProcessEnvironmentVariable('HOWCODE_BASE_URL') ?? DEFAULT_RELEASE_BASE_URL
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000
const updateAllowedInDev = getProcessEnvironmentVariable('HOWCODE_ENABLE_DEV_APP_UPDATE') === '1'
const semverPattern = /^\d+\.\d+\.\d+$/
const sha256Pattern = /^[a-f0-9]{64}$/i

type UpdateTarget = {
  os: 'macos' | 'linux' | 'win'
  arch: 'arm64' | 'x64'
  executable: string
}

type ReleaseInfo = {
  version: string
  hash: string
  assetUrl: string
}

type InstalledUpdate = ReleaseInfo & {
  executablePath: string
  installDir: string
}

type AppUpdaterListener = (state: AppUpdateState) => void

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getTarget(): UpdateTarget {
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

function getCacheRoot() {
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

function getInstallPaths(target: UpdateTarget, release: ReleaseInfo) {
  const cacheRoot = getCacheRoot()
  const releaseKey = `${release.version}-${release.hash}`
  const installDir = path.join(cacheRoot, 'versions', releaseKey)
  return {
    cacheRoot,
    currentFile: path.join(cacheRoot, 'current.json'),
    installDir,
    executablePath: path.join(installDir, target.executable),
  }
}

function getAppResourcesPath(installDir: string, target: UpdateTarget) {
  if (target.os === 'macos') {
    return path.join(installDir, `${APP_NAME}.app`, 'Contents', 'Resources')
  }

  return path.join(installDir, APP_NAME, 'resources')
}

function hasPackagedAppBundle(installDir: string, target: UpdateTarget) {
  const resourcesPath = getAppResourcesPath(installDir, target)
  return (
    existsSync(path.join(resourcesPath, 'app.asar')) ||
    existsSync(path.join(resourcesPath, 'app', 'package.json'))
  )
}

async function isValidInstall(paths: ReturnType<typeof getInstallPaths>, target: UpdateTarget) {
  return (
    (await isExecutableFile(paths.executablePath)) && hasPackagedAppBundle(paths.installDir, target)
  )
}

function isUpdateEnabled() {
  return app.isPackaged || updateAllowedInDev
}

function getCurrentAppVersion() {
  if (app.isPackaged) return app.getVersion()

  try {
    const packageJsonPath = path.join(getAppRootPath(), 'package.json')
    const currentPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: unknown
    }
    if (typeof currentPackageJson.version === 'string') return currentPackageJson.version
  } catch {
    // Fall back to the bundled package metadata below.
  }

  return packageJson.version
}

function assertUpdateEnabled() {
  if (!isUpdateEnabled()) {
    throw new Error('App updates are disabled in development builds.')
  }
}

function assertInstallSupported(target: UpdateTarget) {
  if (target.os === 'win') {
    throw new Error(
      'In-app updates are disabled on Windows installer builds until Start Menu shortcut handoff is implemented.',
    )
  }
}

function normalizeReleaseMetadata(
  metadata: unknown,
  updateUrl: string,
): Pick<ReleaseInfo, 'version' | 'hash'> {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error(`Invalid metadata from ${updateUrl}`)
  }

  const version = 'version' in metadata ? metadata.version : null
  const hash = 'hash' in metadata ? metadata.hash : null

  if (typeof version !== 'string' || !semverPattern.test(version)) {
    throw new Error(`Invalid release version from ${updateUrl}`)
  }

  if (typeof hash !== 'string' || !sha256Pattern.test(hash)) {
    throw new Error(`Invalid release hash from ${updateUrl}`)
  }

  return { version, hash: hash.toLowerCase() }
}

async function fetchJson(url: string, timeoutMs = 15_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
  return response.json() as Promise<unknown>
}

async function resolveLatestRelease(target: UpdateTarget): Promise<ReleaseInfo> {
  const updateUrl = `${RELEASE_BASE_URL}/stable-${target.os}-${target.arch}-update.json`
  const { version, hash } = normalizeReleaseMetadata(await fetchJson(updateUrl), updateUrl)
  const assetBaseUrl =
    RELEASE_BASE_URL === DEFAULT_RELEASE_BASE_URL
      ? `https://github.com/IgorWarzocha/howcode/releases/download/v${version}`
      : RELEASE_BASE_URL
  return {
    version,
    hash,
    assetUrl: `${assetBaseUrl}/${APP_NAME}-${target.os}-${target.arch}.tar.gz`,
  }
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10))
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10))
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

async function downloadFile(url: string, filePath: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
  if (!(response.ok && response.body))
    throw new Error(`HTTP ${response.status} while downloading ${url}`)
  await mkdir(path.dirname(filePath), { recursive: true })
  await pipeline(
    Readable.fromWeb(response.body as unknown as NodeReadableStream),
    createWriteStream(filePath),
  )
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

function parseInstalledUpdateRecord(record: unknown): InstalledUpdate | null {
  if (!record || typeof record !== 'object') return null
  const version = 'version' in record ? record.version : null
  const hash = 'hash' in record ? record.hash : null
  const installDir = 'installDir' in record ? record.installDir : null
  const executablePath = 'executablePath' in record ? record.executablePath : null
  if (
    typeof version !== 'string' ||
    !semverPattern.test(version) ||
    typeof hash !== 'string' ||
    !sha256Pattern.test(hash) ||
    typeof installDir !== 'string' ||
    typeof executablePath !== 'string'
  ) {
    return null
  }
  return { version, hash: hash.toLowerCase(), installDir, executablePath, assetUrl: '' }
}

async function isExecutableFile(filePath: string) {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function pruneOldVersions(cacheRoot: string, keepDir: string) {
  const versionsRoot = path.join(cacheRoot, 'versions')
  const runningVersionDir = getRunningCachedVersionDir(versionsRoot)
  let entries: Array<{ isDirectory(): boolean; name: string }>
  try {
    entries = await readdir(versionsRoot, { withFileTypes: true })
  } catch {
    return
  }
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(versionsRoot, entry.name))
      .filter((dirPath) => dirPath !== keepDir)
      .filter((dirPath) => dirPath !== runningVersionDir)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  )
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

export class AppUpdater {
  private readonly listeners = new Set<AppUpdaterListener>()
  private installedUpdate: InstalledUpdate | null = null
  private checkPromise: Promise<AppUpdateState> | null = null
  private installPromise: Promise<AppUpdateState> | null = null
  private restorePromise: Promise<void> | null = null
  private latestRelease: ReleaseInfo | null = null
  private state: AppUpdateState = {
    status: 'idle',
    currentVersion: getCurrentAppVersion(),
    latestVersion: null,
    error: null,
  }

  subscribe(listener: AppUpdaterListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState() {
    if (!app.isPackaged) {
      const currentVersion = getCurrentAppVersion()
      if (this.state.currentVersion !== currentVersion) {
        this.state = { ...this.state, currentVersion }
      }
    }

    return this.state
  }

  async restoreInstalledUpdate() {
    if (this.restorePromise) return this.restorePromise
    this.restorePromise = this.readInstalledUpdate().finally(() => {
      this.restorePromise = null
    })
    return this.restorePromise
  }

  async checkForUpdate() {
    if (this.checkPromise) return this.checkPromise
    this.checkPromise = this.checkForUpdateInner().finally(() => {
      this.checkPromise = null
    })
    return this.checkPromise
  }

  private async checkForUpdateInner() {
    if (!isUpdateEnabled()) {
      this.setState({
        status: 'up-to-date',
        latestVersion: this.state.currentVersion,
        error: null,
      })
      return this.state
    }

    await this.restoreInstalledUpdate()
    if (this.installedUpdate) {
      this.setState({ status: 'ready', latestVersion: this.installedUpdate.version, error: null })
      return this.state
    }

    this.setState({ status: 'checking', error: null })
    try {
      const target = getTarget()
      if (target.os === 'win') {
        this.setState({
          status: 'up-to-date',
          latestVersion: this.state.currentVersion,
          error: null,
        })
        return this.state
      }
      const release = await resolveLatestRelease(target)
      this.latestRelease = release
      const hasUpdate = compareVersions(release.version, this.state.currentVersion) > 0
      this.setState({
        status: hasUpdate ? 'available' : 'up-to-date',
        latestVersion: hasUpdate ? release.version : this.state.currentVersion,
        error: null,
      })
    } catch (error) {
      this.setState({ status: 'error', error: getErrorMessage(error) })
    }
    return this.state
  }

  async installUpdate() {
    if (this.installPromise) return this.installPromise
    this.installPromise = this.installUpdateInner().finally(() => {
      this.installPromise = null
    })
    return this.installPromise
  }

  private async installUpdateInner() {
    let tempRoot: string | null = null
    let tempInstallDir: string | null = null
    try {
      assertUpdateEnabled()
      const release = this.latestRelease ?? (await this.resolveAvailableRelease())
      this.setState({ status: 'downloading', latestVersion: release.version, error: null })
      const target = getTarget()
      assertInstallSupported(target)
      const paths = getInstallPaths(target, release)
      const currentRecord = await this.readCurrentFile(paths.currentFile)
      const existingCacheTrusted =
        currentRecord?.version === release.version &&
        currentRecord.hash === release.hash &&
        currentRecord.installDir === paths.installDir &&
        currentRecord.executablePath === paths.executablePath &&
        (await isValidInstall(paths, target))
      if (!existingCacheTrusted) {
        tempRoot = path.join(paths.cacheRoot, `.tmp-update-${Date.now()}-${process.pid}`)
        tempInstallDir = `${paths.installDir}.partial`
        const archivePath = path.join(tempRoot, `${APP_NAME}-${target.os}-${target.arch}.tar.gz`)
        await rm(tempRoot, { recursive: true, force: true })
        await rm(tempInstallDir, { recursive: true, force: true })
        await mkdir(tempRoot, { recursive: true })
        await downloadFile(release.assetUrl, archivePath)
        const hash = await sha256File(archivePath)
        if (hash !== release.hash)
          throw new Error(
            `Downloaded archive hash mismatch. Expected ${release.hash}, got ${hash}.`,
          )
        this.setState({ status: 'installing', latestVersion: release.version, error: null })
        await mkdir(tempInstallDir, { recursive: true })
        await extractTar({ file: archivePath, cwd: tempInstallDir })
        if (!existsSync(path.join(tempInstallDir, target.executable))) {
          throw new Error(`Downloaded archive did not contain ${target.executable}.`)
        }
        if (!hasPackagedAppBundle(tempInstallDir, target)) {
          throw new Error('Downloaded archive did not contain the packaged app bundle.')
        }
        await rm(paths.installDir, { recursive: true, force: true })
        await mkdir(path.dirname(paths.installDir), { recursive: true })
        await rename(tempInstallDir, paths.installDir)
        tempInstallDir = null
        await rm(tempRoot, { recursive: true, force: true })
        tempRoot = null
      }

      await writeFile(
        paths.currentFile,
        JSON.stringify(
          {
            version: release.version,
            hash: release.hash,
            installDir: paths.installDir,
            executablePath: paths.executablePath,
          },
          null,
          2,
        ),
      )
      this.installedUpdate = {
        ...release,
        executablePath: paths.executablePath,
        installDir: paths.installDir,
      }
      await pruneOldVersions(paths.cacheRoot, paths.installDir)
      this.setState({ status: 'ready', latestVersion: release.version, error: null })
    } catch (error) {
      this.setState({ status: 'error', error: getErrorMessage(error) })
    } finally {
      await Promise.all([
        tempRoot ? rm(tempRoot, { recursive: true, force: true }) : Promise.resolve(),
        tempInstallDir ? rm(tempInstallDir, { recursive: true, force: true }) : Promise.resolve(),
      ]).catch(() => {
        // Ignore cleanup errors while preserving the original install failure.
      })
    }
    return this.state
  }

  async restartToUpdate() {
    await this.restoreInstalledUpdate()
    if (!this.installedUpdate) return this.state
    this.setState({ status: 'restarting', error: null })
    try {
      await spawnDetached(this.installedUpdate.executablePath)
      app.quit()
    } catch (error) {
      this.setState({ status: 'error', error: getErrorMessage(error) })
    }
    return this.state
  }

  private async readInstalledUpdate() {
    if (!isUpdateEnabled()) return
    this.installedUpdate = null
    const record = await this.readCurrentFile(path.join(getCacheRoot(), 'current.json'))
    if (!record || compareVersions(record.version, this.state.currentVersion) <= 0) return
    const target = getTarget()
    const expectedPaths = getInstallPaths(target, record)
    if (
      record.installDir !== expectedPaths.installDir ||
      record.executablePath !== expectedPaths.executablePath
    ) {
      return
    }
    if (!(await isValidInstall(expectedPaths, target))) return
    this.installedUpdate = record
    this.latestRelease = record
    this.setState({ status: 'ready', latestVersion: record.version, error: null })
  }

  private async readCurrentFile(currentFile: string) {
    try {
      return parseInstalledUpdateRecord(JSON.parse(await readFile(currentFile, 'utf8')))
    } catch {
      return null
    }
  }

  private async resolveAvailableRelease() {
    await this.checkForUpdate()
    if (!this.latestRelease || this.state.status !== 'available') {
      throw new Error('No update is available.')
    }
    return this.latestRelease
  }

  private setState(nextState: Partial<AppUpdateState>) {
    this.state = { ...this.state, ...nextState }
    for (const listener of this.listeners) listener(this.state)
  }
}
