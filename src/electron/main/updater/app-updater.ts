import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import type { AppUpdateState } from '../../../../shared/desktop-app-update-contracts'
import { spawnDetached } from './spawn-detached'
import { installUpdateBundle } from './update-installer'
import { isUpdateCandidate, type UpdateChannel } from './update-protocol'
import {
  assertUpdateEnabled,
  getCurrentAppVersion,
  isUpdateEnabled,
  resolveLatestRelease,
} from './update-runtime'
import {
  getCacheRoot,
  getInstallPaths,
  getLegacyInstallPaths,
  getRunningReleaseFingerprint,
  getTarget,
  type InstalledUpdate,
  isValidInstall,
  parseInstalledUpdateRecord,
  pruneOldVersions,
  type ReleaseInfo,
  type UpdateTarget,
} from './update-storage'
import { writeAtomicJson } from './update-transport'

type AppUpdaterListener = (state: AppUpdateState) => void

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function logUpdateFailure(operation: string, error: unknown) {
  console.error(`[howcode updater] ${operation} failed`, error)
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

  private async installRelease(
    release: ReleaseInfo,
    target: UpdateTarget,
    paths: ReturnType<typeof getInstallPaths>,
  ) {
    const { installedUpdate, keepDirs } = await installUpdateBundle({
      release,
      target,
      paths,
      getKeepDirs: (installDir) => this.getPruneKeepDirs(installDir),
      onInstalling: () =>
        this.setState({
          status: 'installing',
          latestVersion: release.version,
          channel: release.channel,
          error: null,
        }),
    })
    this.installedUpdate = installedUpdate
    await pruneOldVersions(paths.cacheRoot, keepDirs)
    this.setState({
      status: 'ready',
      latestVersion: release.version,
      channel: release.channel,
      error: null,
    })
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
