import { existsSync, readFileSync } from 'node:fs'
import { chmod, mkdir, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { x as extractTar } from 'tar'
import packageJson from '../../../../package.json'
import type { AppUpdateState } from '../../../../shared/desktop-app-update-contracts'
import { getAppRootPath } from '../runtime/app-paths'
import { spawnDetached } from './spawn-detached'
import { isUpdateCandidate, normalizeReleaseMetadata, type UpdateChannel } from './update-protocol'
import {
  APP_NAME,
  getAppResourcesPath,
  getCacheRoot,
  getInstallPaths,
  getLegacyInstallPaths,
  getRunningReleaseFingerprint,
  getTarget,
  hasPackagedAppBundle,
  type InstalledUpdate,
  isValidInstall,
  parseInstalledUpdateRecord,
  pruneOldVersions,
  type ReleaseInfo,
  type UpdateTarget,
} from './update-storage'
import {
  downloadFile,
  fetchJson,
  isExecutableFile,
  sha256File,
  withUpdateLock,
  writeAtomicJson,
} from './update-transport'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const DEFAULT_RELEASE_BASE_URL = 'https://github.com/IgorWarzocha/howcode/releases/download'
const RELEASE_BASE_URL = getProcessEnvironmentVariable('HOWCODE_BASE_URL')
const updateAllowedInDev = getProcessEnvironmentVariable('HOWCODE_ENABLE_DEV_APP_UPDATE') === '1'
const trailingSlashesPattern = /\/+$/
const trailingChannelPattern = /\/(?:main|dev|channel-main|channel-dev)$/i
const channelPlaceholderPattern = /\{channel\}/g
const releaseTagPlaceholderPattern = /\{releaseTag\}/g

type AppUpdaterListener = (state: AppUpdateState) => void

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function logUpdateFailure(operation: string, error: unknown) {
  console.error(`[howcode updater] ${operation} failed`, error)
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

function getMissingPackagedBundleMessage(installDir: string, target: UpdateTarget) {
  const resourcesPath = getAppResourcesPath(installDir, target)
  const appAsarPath = path.join(resourcesPath, 'app.asar')
  const unpackedAppPath = path.join(resourcesPath, 'app', 'package.json')
  return [
    'Downloaded archive did not contain the packaged app bundle.',
    `Checked ${appAsarPath} and ${unpackedAppPath}.`,
  ].join(' ')
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
      await writeAtomicJson(paths.currentFile, {
        version: this.installedUpdate.version,
        channel: this.installedUpdate.channel,
        hash: this.installedUpdate.hash,
        installDir: this.installedUpdate.installDir,
        executablePath: this.installedUpdate.executablePath,
      })
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
      await writeAtomicJson(currentFile, record).catch(() => undefined)
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
