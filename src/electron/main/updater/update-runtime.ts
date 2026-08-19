import { readFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import packageJson from '../../../../package.json'
import { getAppRootPath } from '../runtime/app-paths'
import { normalizeReleaseMetadata, type UpdateChannel } from './update-protocol'
import { APP_NAME, type ReleaseInfo, type UpdateTarget } from './update-storage'
import { fetchJson } from './update-transport'

const DEFAULT_RELEASE_BASE_URL = 'https://github.com/IgorWarzocha/howcode/releases/download'
function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const RELEASE_BASE_URL = getProcessEnvironmentVariable('HOWCODE_BASE_URL')
const updateAllowedInDev = getProcessEnvironmentVariable('HOWCODE_ENABLE_DEV_APP_UPDATE') === '1'
const trailingSlashesPattern = /\/+$/
const trailingChannelPattern = /\/(?:main|dev|channel-main|channel-dev)$/i
const channelPlaceholderPattern = /\{channel\}/g
const releaseTagPlaceholderPattern = /\{releaseTag\}/g

export function getReleaseBaseUrl(channel: UpdateChannel) {
  const releaseTag = `channel-${channel}`
  if (!RELEASE_BASE_URL) return `${DEFAULT_RELEASE_BASE_URL}/${releaseTag}`
  const baseUrl = RELEASE_BASE_URL.replace(trailingSlashesPattern, '')
  if (baseUrl.includes('{releaseTag}')) {
    return baseUrl.replace(releaseTagPlaceholderPattern, releaseTag)
  }
  if (baseUrl.includes('{channel}')) return baseUrl.replace(channelPlaceholderPattern, releaseTag)
  return baseUrl.replace(trailingChannelPattern, `/${releaseTag}`)
}

export function isUpdateEnabled() {
  return app.isPackaged || updateAllowedInDev
}

export function assertUpdateEnabled() {
  if (!isUpdateEnabled()) {
    throw new Error('App updates are disabled in development builds.')
  }
}

export function getCurrentAppVersion() {
  if (app.isPackaged) return app.getVersion()
  try {
    const currentPackageJson = JSON.parse(
      readFileSync(path.join(getAppRootPath(), 'package.json'), 'utf8'),
    ) as { version?: unknown }
    if (typeof currentPackageJson.version === 'string') return currentPackageJson.version
  } catch {
    // Fall back to the bundled package metadata below.
  }
  return packageJson.version
}

export async function resolveLatestRelease(
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
  return { channel, version, hash, assetUrl }
}
