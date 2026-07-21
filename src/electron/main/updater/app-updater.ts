import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'node:fs'
import {
  access,
  chmod,
  constants,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
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
import {
  addCacheBust,
  isUpdateCandidate,
  normalizeReleaseMetadata,
  type UpdateChannel,
} from './update-protocol'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const APP_NAME = 'howcode'
const DEFAULT_RELEASE_BASE_URL = 'https://github.com/IgorWarzocha/howcode/releases/download'
const RELEASE_BASE_URL = getProcessEnvironmentVariable('HOWCODE_BASE_URL')
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000
const updateAllowedInDev = getProcessEnvironmentVariable('HOWCODE_ENABLE_DEV_APP_UPDATE') === '1'
const semverPattern = /^\d+\.\d+\.\d+$/
const sha256Pattern = /^[a-f0-9]{64}$/i
const channelReleaseKeyPattern = /^(main|dev)-(\d+\.\d+\.\d+)-([a-f0-9]{64})$/i
const legacyReleaseKeyPattern = /^(\d+\.\d+\.\d+)-([a-f0-9]{64})$/i
const trailingSlashesPattern = /\/+$/
const trailingChannelPattern = /\/(?:main|dev|channel-main|channel-dev)$/i
const channelPlaceholderPattern = /\{channel\}/g
const releaseTagPlaceholderPattern = /\{releaseTag\}/g

type UpdateTarget = {
  os: 'macos' | 'linux' | 'win'
  arch: 'arm64' | 'x64'
  executable: string
}

type ReleaseInfo = {
  channel: UpdateChannel
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

function logUpdateFailure(operation: string, error: unknown) {
  console.error(`[howcode updater] ${operation} failed`, error)
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

function getChannelReleaseTag(channel: UpdateChannel) {
  return `channel-${channel}`
}

function getReleaseBaseUrl(channel: UpdateChannel) {
  const releaseTag = getChannelReleaseTag(channel)
  if (!RELEASE_BASE_URL) return `${DEFAULT_RELEASE_BASE_URL}/${releaseTag}`

  const baseUrl = RELEASE_BASE_URL.replace(trailingSlashesPattern, '')
  if (baseUrl.includes('{releaseTag}'))
    return baseUrl.replace(releaseTagPlaceholderPattern, releaseTag)
  if (baseUrl.includes('{channel}')) return baseUrl.replace(channelPlaceholderPattern, releaseTag)

  return baseUrl.replace(trailingChannelPattern, `/${releaseTag}`)
}

function getReleaseKey(release: Pick<ReleaseInfo, 'channel' | 'version' | 'hash'>) {
  return `${release.channel}-${release.version}-${release.hash}`
}

function getInstallPaths(target: UpdateTarget, release: ReleaseInfo) {
  const cacheRoot = getCacheRoot()
  const releaseKey = getReleaseKey(release)
  const installDir = path.join(cacheRoot, 'versions', releaseKey)
  return {
    cacheRoot,
    currentFile: path.join(cacheRoot, `current-${release.channel}.json`),
    installDir,
    executablePath: path.join(installDir, target.executable),
  }
}

function getLegacyInstallPaths(target: UpdateTarget, release: ReleaseInfo) {
  const cacheRoot = getCacheRoot()
  const installDir = path.join(cacheRoot, 'versions', `${release.version}-${release.hash}`)
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

function getMissingPackagedBundleMessage(installDir: string, target: UpdateTarget) {
  const resourcesPath = getAppResourcesPath(installDir, target)
  const appAsarPath = path.join(resourcesPath, 'app.asar')
  const unpackedAppPath = path.join(resourcesPath, 'app', 'package.json')
  return [
    'Downloaded archive did not contain the packaged app bundle.',
    `Checked ${appAsarPath} and ${unpackedAppPath}.`,
  ].join(' ')
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

async function fetchJson(url: string, timeoutMs = 15_000) {
  return retry(async () => {
    const response = await fetch(addCacheBust(url), {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
    return response.json() as Promise<unknown>
  })
}

async function retry<T>(operation: () => Promise<T>, attempts = 3) {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1) break
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }
  throw lastError
}

async function resolveLatestRelease(
  target: UpdateTarget,
  channel: UpdateChannel,
): Promise<ReleaseInfo> {
  const releaseBaseUrl = getReleaseBaseUrl(channel)
  const updateUrl = `${releaseBaseUrl}/stable-${target.os}-${target.arch}-update.json`
  const fallbackAssetUrl = `${releaseBaseUrl}/${APP_NAME}-${target.os}-${target.arch}.tar.gz`
  const { version, hash, assetUrl } = normalizeReleaseMetadata(
    await fetchJson(updateUrl),
    updateUrl,
    releaseBaseUrl,
    channel,
    fallbackAssetUrl,
  )
  return {
    channel,
    version,
    hash,
    assetUrl,
  }
}

async function downloadFile(url: string, filePath: string) {
  await retry(async () => {
    const response = await fetch(addCacheBust(url), {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!(response.ok && response.body))
      throw new Error(`HTTP ${response.status} while downloading ${url}`)
    await mkdir(path.dirname(filePath), { recursive: true })
    await pipeline(
      Readable.fromWeb(response.body as unknown as NodeReadableStream),
      createWriteStream(filePath),
    )
  })
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

function parseInstalledUpdateRecord(
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

async function writeInstalledUpdateRecord(currentFile: string, record: InstalledUpdate) {
  const temporaryFile = `${currentFile}.tmp-${process.pid}-${Date.now()}`
  await mkdir(path.dirname(currentFile), { recursive: true })
  try {
    await writeFile(
      temporaryFile,
      JSON.stringify(
        {
          version: record.version,
          channel: record.channel,
          hash: record.hash,
          installDir: record.installDir,
          executablePath: record.executablePath,
        },
        null,
        2,
      ),
    )
    await rename(temporaryFile, currentFile)
  } catch (error) {
    await rm(temporaryFile, { force: true }).catch(() => undefined)
    throw error
  }
}

async function withUpdateLock<T>(cacheRoot: string, operation: () => Promise<T>) {
  const lockPath = path.join(cacheRoot, '.update.lock')
  await mkdir(cacheRoot, { recursive: true })
  let acquired = false

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await mkdir(lockPath)
      acquired = true
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      try {
        const ageMs = Date.now() - (await stat(lockPath)).mtimeMs
        if (ageMs > 15 * 60_000) await rm(lockPath, { recursive: true, force: true })
      } catch {
        // The other updater may have released the lock between stat and cleanup.
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  if (!acquired) throw new Error('Another Howcode update is still running. Try again shortly.')

  try {
    return await operation()
  } finally {
    await rm(lockPath, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function isExecutableFile(filePath: string) {
  try {
    if (!(await stat(filePath)).isFile()) return false
    if (process.platform !== 'win32') await access(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function pruneOldVersions(cacheRoot: string, keepDirs: ReadonlySet<string>) {
  const versionsRoot = path.join(cacheRoot, 'versions')
  const runningVersionDir = getRunningCachedVersionDir(versionsRoot)
  let entries: Array<{ isDirectory(): boolean; name: string }>
  try {
    entries = await readdir(versionsRoot, { withFileTypes: true })
  } catch {
    return
  }
  await Promise.all(
    entries.flatMap((entry) => {
      if (!entry.isDirectory()) return []
      const dirPath = path.join(versionsRoot, entry.name)
      return keepDirs.has(dirPath) || dirPath === runningVersionDir
        ? []
        : [rm(dirPath, { recursive: true, force: true })]
    }),
  )
}

function getRunningReleaseKey() {
  const runningVersionDir = getRunningCachedVersionDir(path.join(getCacheRoot(), 'versions'))
  return runningVersionDir ? path.basename(runningVersionDir) : null
}

function getRunningReleaseFingerprint() {
  const runningReleaseKey = getRunningReleaseKey()
  if (!runningReleaseKey) return null

  const channelPrefixedMatch = channelReleaseKeyPattern.exec(runningReleaseKey)
  if (channelPrefixedMatch?.[2] && channelPrefixedMatch[3]) {
    return {
      version: channelPrefixedMatch[2],
      hash: channelPrefixedMatch[3].toLowerCase(),
    }
  }

  const legacyMatch = legacyReleaseKeyPattern.exec(runningReleaseKey)
  if (legacyMatch?.[1] && legacyMatch[2]) {
    return {
      version: legacyMatch[1],
      hash: legacyMatch[2].toLowerCase(),
    }
  }

  return null
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

function isSameRelease(
  left: Pick<ReleaseInfo, 'channel' | 'version' | 'hash'>,
  right: Pick<ReleaseInfo, 'channel' | 'version' | 'hash'>,
) {
  return (
    left.channel === right.channel && left.version === right.version && left.hash === right.hash
  )
}

export class AppUpdater {
  private readonly listeners = new Set<AppUpdaterListener>()
  private readonly getUpdateChannel: () => Promise<UpdateChannel>
  private installedUpdate: InstalledUpdate | null = null
  private checkPromise: Promise<AppUpdateState> | null = null
  private installPromise: Promise<AppUpdateState> | null = null
  private restorePromise: Promise<void> | null = null
  private latestRelease: ReleaseInfo | null = null
  private state: AppUpdateState = {
    status: 'idle',
    currentVersion: getCurrentAppVersion(),
    latestVersion: null,
    channel: null,
    error: null,
  }

  constructor(getUpdateChannel: () => Promise<UpdateChannel> = async () => 'main') {
    this.getUpdateChannel = getUpdateChannel
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
    const latestRelease = this.latestRelease
    this.restorePromise = this.readInstalledUpdate().finally(() => {
      if (
        latestRelease &&
        this.installedUpdate &&
        !isSameRelease(this.installedUpdate, latestRelease)
      ) {
        this.latestRelease = latestRelease
      }
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

  async checkAndInstall() {
    const state = await this.checkForUpdate()
    if (state.status === 'available') return this.installUpdate()
    return state
  }

  /**
   * The installed app remains immutable. A staged bundle is the handoff target for every OS,
   * including Windows where replacing a running executable is not possible. Old bridge builds can
   * therefore hand off once to this updater, after which all future launches use the same path.
   */
  async takeoverIfReady() {
    try {
      await this.restoreInstalledUpdate()
      if (!this.installedUpdate) return false
      this.setState({
        status: 'restarting',
        latestVersion: this.installedUpdate.version,
        channel: this.installedUpdate.channel,
        error: null,
      })
      await spawnDetached(this.installedUpdate.executablePath)
      app.quit()
      return true
    } catch (error) {
      logUpdateFailure('takeover', error)
      this.setState({ status: 'error', error: getErrorMessage(error) })
      return false
    }
  }

  private async checkForUpdateInner() {
    try {
      const channel = await this.getUpdateChannel()
      if (this.state.channel !== channel) {
        this.latestRelease = null
        this.installedUpdate = null
        this.setState({ status: 'idle', latestVersion: null, channel, error: null })
      }

      if (!isUpdateEnabled()) {
        this.setState({
          status: 'up-to-date',
          latestVersion: this.state.currentVersion,
          channel,
          error: null,
        })
        return this.state
      }

      this.setState({ status: 'checking', error: null })
      const target = getTarget()
      let release: ReleaseInfo
      try {
        release = await resolveLatestRelease(target, channel)
      } catch (error) {
        await this.restoreInstalledUpdate()
        if (this.installedUpdate) {
          this.setState({
            status: 'ready',
            latestVersion: this.installedUpdate.version,
            channel: this.installedUpdate.channel,
            error: null,
          })
          return this.state
        }
        throw error
      }
      this.latestRelease = release
      await this.restoreInstalledUpdate()
      if (this.installedUpdate && isSameRelease(this.installedUpdate, release)) {
        this.setState({
          status: 'ready',
          latestVersion: release.version,
          channel: release.channel,
          error: null,
        })
        return this.state
      }
      this.installedUpdate = null
      this.latestRelease = release
      const hasUpdate = this.isUpdateCandidate(release)
      this.setState({
        status: hasUpdate ? 'available' : 'up-to-date',
        latestVersion: hasUpdate ? release.version : this.state.currentVersion,
        channel: release.channel,
        error: null,
      })
    } catch (error) {
      logUpdateFailure('check', error)
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
    try {
      assertUpdateEnabled()
      const release = this.latestRelease ?? (await this.resolveAvailableRelease())
      const channel = await this.getUpdateChannel()
      if (release.channel !== channel) {
        this.latestRelease = null
        throw new Error('Update channel changed. Check for updates again before installing.')
      }
      this.setState({
        status: 'downloading',
        latestVersion: release.version,
        channel: release.channel,
        error: null,
      })
      const target = getTarget()
      const paths = getInstallPaths(target, release)
      await this.installRelease(release, target, paths)
    } catch (error) {
      logUpdateFailure('install', error)
      this.setState({ status: 'error', error: getErrorMessage(error) })
    }
    return this.state
  }

  private installRelease(
    release: ReleaseInfo,
    target: UpdateTarget,
    paths: ReturnType<typeof getInstallPaths>,
  ) {
    return withUpdateLock(paths.cacheRoot, () =>
      this.installReleaseUnderLock(release, target, paths),
    )
  }

  private async installReleaseUnderLock(
    release: ReleaseInfo,
    target: UpdateTarget,
    paths: ReturnType<typeof getInstallPaths>,
  ) {
    let tempRoot: string | null = null
    let tempInstallDir: string | null = null
    try {
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
        this.setState({
          status: 'installing',
          latestVersion: release.version,
          channel: release.channel,
          error: null,
        })
        await mkdir(tempInstallDir, { recursive: true })
        await extractTar({ file: archivePath, cwd: tempInstallDir })
        const extractedExecutablePath = path.join(tempInstallDir, target.executable)
        if (!existsSync(extractedExecutablePath)) {
          throw new Error(`Downloaded archive did not contain ${target.executable}.`)
        }
        if (process.platform !== 'win32') {
          await chmod(extractedExecutablePath, 0o755)
        }
        if (!(await isExecutableFile(extractedExecutablePath))) {
          throw new Error(`Downloaded archive did not contain ${target.executable}.`)
        }
        if (!hasPackagedAppBundle(tempInstallDir, target)) {
          throw new Error(getMissingPackagedBundleMessage(tempInstallDir, target))
        }
        await rm(paths.installDir, { recursive: true, force: true })
        await mkdir(path.dirname(paths.installDir), { recursive: true })
        await rename(tempInstallDir, paths.installDir)
        tempInstallDir = null
        await rm(tempRoot, { recursive: true, force: true })
        tempRoot = null
      }

      this.installedUpdate = {
        ...release,
        executablePath: paths.executablePath,
        installDir: paths.installDir,
      }
      await writeInstalledUpdateRecord(paths.currentFile, this.installedUpdate)
      await pruneOldVersions(paths.cacheRoot, await this.getPruneKeepDirs(paths.installDir))
      this.setState({
        status: 'ready',
        latestVersion: release.version,
        channel: release.channel,
        error: null,
      })
    } finally {
      await Promise.all([
        tempRoot ? rm(tempRoot, { recursive: true, force: true }) : Promise.resolve(),
        tempInstallDir ? rm(tempInstallDir, { recursive: true, force: true }) : Promise.resolve(),
      ]).catch(() => {
        // Ignore cleanup errors while preserving the original install failure.
      })
    }
  }

  async restartToUpdate() {
    try {
      await this.restoreInstalledUpdate()
      if (!this.installedUpdate) {
        this.setState({ status: 'idle', latestVersion: null, error: null })
        return this.state
      }
      if (this.latestRelease && !isSameRelease(this.installedUpdate, this.latestRelease)) {
        this.installedUpdate = null
        this.setState({
          status: 'available',
          latestVersion: this.latestRelease.version,
          error: null,
        })
        return this.state
      }
      this.setState({ status: 'restarting', channel: this.installedUpdate.channel, error: null })
      await spawnDetached(this.installedUpdate.executablePath)
      app.quit()
    } catch (error) {
      logUpdateFailure('restart', error)
      this.setState({ status: 'error', error: getErrorMessage(error) })
    }
    return this.state
  }

  private async readInstalledUpdate() {
    if (!isUpdateEnabled()) return
    this.installedUpdate = null
    const channel = await this.getUpdateChannel()
    const currentFile = path.join(getCacheRoot(), `current-${channel}.json`)
    const legacyCurrentFile = path.join(getCacheRoot(), 'current.json')
    const record =
      (await this.readCurrentFile(currentFile)) ??
      (await this.readCurrentFile(legacyCurrentFile, channel))
    if (!(record && this.isUpdateCandidate(record))) return
    const target = getTarget()
    const expectedPaths = getInstallPaths(target, record)
    const legacyPaths = getLegacyInstallPaths(target, record)
    const paths =
      record.installDir === legacyPaths.installDir &&
      record.executablePath === legacyPaths.executablePath
        ? legacyPaths
        : expectedPaths
    if (record.installDir !== paths.installDir || record.executablePath !== paths.executablePath) {
      return
    }
    if (!(await isValidInstall(paths, target))) return
    this.installedUpdate = record
    this.latestRelease = record
    if (paths === legacyPaths) {
      await writeInstalledUpdateRecord(currentFile, record).catch(() => undefined)
    }
    this.setState({
      status: 'ready',
      latestVersion: record.version,
      channel: record.channel,
      error: null,
    })
  }

  private isUpdateCandidate(release: Pick<ReleaseInfo, 'channel' | 'version' | 'hash'>) {
    return isUpdateCandidate(this.state.currentVersion, release, getRunningReleaseFingerprint())
  }

  private async getPruneKeepDirs(installDir: string) {
    const keepDirs = new Set([installDir])
    await Promise.all(
      (['main', 'dev'] as const).map(async (channel) => {
        const record = await this.readCurrentFile(
          path.join(getCacheRoot(), `current-${channel}.json`),
        )
        if (record?.installDir) keepDirs.add(record.installDir)
      }),
    )
    return keepDirs
  }

  private async readCurrentFile(currentFile: string, fallbackChannel: UpdateChannel | null = null) {
    try {
      return parseInstalledUpdateRecord(
        JSON.parse(await readFile(currentFile, 'utf8')),
        fallbackChannel,
      )
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
