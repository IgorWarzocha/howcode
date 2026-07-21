const { APP_NAME, CHANNEL_RELEASE_TAGS, RELEASE_BASE_URL, getReleaseChannel } = require('./config')

const trailingSlashesPattern = /\/+$/
const trailingChannelPattern = /\/(?:main|dev|channel-main|channel-dev)$/i
const releaseTagPlaceholderPattern = /\{releaseTag\}/g
const channelPlaceholderPattern = /\{channel\}/g
const FETCH_METADATA_TIMEOUT_MS = 30_000
const UPDATE_PROTOCOL_VERSION = 2
const semverPattern = /^\d+\.\d+\.\d+$/
const sha256Pattern = /^[a-f0-9]{64}$/i

function getReleaseBaseUrl(channel = getReleaseChannel()) {
  const releaseTag = CHANNEL_RELEASE_TAGS[channel]
  const baseUrl = RELEASE_BASE_URL.replace(trailingSlashesPattern, '')
  if (baseUrl.includes('{releaseTag}')) {
    return baseUrl.replace(releaseTagPlaceholderPattern, releaseTag)
  }
  if (baseUrl.includes('{channel}')) return baseUrl.replace(channelPlaceholderPattern, releaseTag)
  return baseUrl.replace(trailingChannelPattern, `/${releaseTag}`)
}

function addCacheBust(url) {
  const parsed = new URL(url)
  parsed.searchParams.set('cacheBust', `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  return parsed.toString()
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_METADATA_TIMEOUT_MS)
  try {
    const response = await fetch(addCacheBust(url), {
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function validateReleaseMetadata(metadata, updateUrl, releaseBaseUrl, channel, fallbackAssetUrl) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error(`Invalid release metadata from ${updateUrl}`)
  }
  if (
    metadata.protocolVersion !== undefined &&
    (!Number.isInteger(metadata.protocolVersion) ||
      metadata.protocolVersion < 1 ||
      metadata.protocolVersion > UPDATE_PROTOCOL_VERSION)
  ) {
    throw new Error(`Unsupported update protocol from ${updateUrl}`)
  }
  if (metadata.channel !== undefined && metadata.channel !== channel) {
    throw new Error(`Release channel mismatch from ${updateUrl}`)
  }
  if (!(semverPattern.test(metadata.version) && sha256Pattern.test(metadata.hash))) {
    throw new Error(`Invalid release metadata from ${updateUrl}`)
  }

  const resolvedAssetUrl = new URL(metadata.assetUrl || fallbackAssetUrl, `${releaseBaseUrl}/`)
  const trustedReleaseBase = new URL(`${releaseBaseUrl}/`)
  const trustedPath = trustedReleaseBase.pathname.endsWith('/')
    ? trustedReleaseBase.pathname
    : `${trustedReleaseBase.pathname}/`
  if (
    resolvedAssetUrl.origin !== trustedReleaseBase.origin ||
    !resolvedAssetUrl.pathname.startsWith(trustedPath)
  ) {
    throw new Error(`Update metadata points to an untrusted asset URL: ${resolvedAssetUrl}`)
  }

  return {
    channel,
    version: metadata.version,
    hash: metadata.hash.toLowerCase(),
    assetUrl: resolvedAssetUrl.toString(),
  }
}

async function resolveLatestRelease(target) {
  const channel = getReleaseChannel()
  const releaseBaseUrl = getReleaseBaseUrl(channel)
  const updateUrl = `${releaseBaseUrl}/stable-${target.os}-${target.arch}-update.json`
  const metadata = await fetchJson(updateUrl)
  return validateReleaseMetadata(
    metadata,
    updateUrl,
    releaseBaseUrl,
    channel,
    `${releaseBaseUrl}/${APP_NAME}-${target.os}-${target.arch}.tar.gz`,
  )
}

module.exports = { resolveLatestRelease }
