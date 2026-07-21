export type UpdateChannel = 'main' | 'dev'

export type UpdateReleaseMetadata = {
  version: string
  hash: string
  assetUrl: string
}

type ReleaseFingerprint = Pick<UpdateReleaseMetadata, 'version' | 'hash'>

const semverPattern = /^\d+\.\d+\.\d+$/
const sha256Pattern = /^[a-f0-9]{64}$/i

function readMetadataFields(metadata: unknown, updateUrl: string) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error(`Invalid metadata from ${updateUrl}`)
  }

  return {
    version: 'version' in metadata ? metadata.version : null,
    hash: 'hash' in metadata ? metadata.hash : null,
    assetUrl: 'assetUrl' in metadata ? metadata.assetUrl : null,
    channel: 'channel' in metadata ? metadata.channel : null,
    protocolVersion: 'protocolVersion' in metadata ? metadata.protocolVersion : null,
  }
}

function validateMetadataFields(
  fields: ReturnType<typeof readMetadataFields>,
  updateUrl: string,
  expectedChannel: UpdateChannel,
): asserts fields is ReturnType<typeof readMetadataFields> & { version: string; hash: string } {
  if (
    fields.protocolVersion !== null &&
    (typeof fields.protocolVersion !== 'number' ||
      fields.protocolVersion < 1 ||
      fields.protocolVersion > 2)
  ) {
    throw new Error(`Unsupported update protocol from ${updateUrl}`)
  }
  if (fields.channel !== null && fields.channel !== expectedChannel) {
    throw new Error(`Release channel mismatch from ${updateUrl}`)
  }
  if (typeof fields.version !== 'string' || !semverPattern.test(fields.version)) {
    throw new Error(`Invalid release version from ${updateUrl}`)
  }
  if (typeof fields.hash !== 'string' || !sha256Pattern.test(fields.hash)) {
    throw new Error(`Invalid release hash from ${updateUrl}`)
  }
}

function resolveTrustedAssetUrl(
  assetUrl: unknown,
  releaseBaseUrl: string,
  fallbackAssetUrl: string,
  updateUrl: string,
) {
  const resolvedAssetUrl = new URL(
    typeof assetUrl === 'string' && assetUrl.length > 0 ? assetUrl : fallbackAssetUrl,
    `${releaseBaseUrl}/`,
  )
  const trustedReleaseBase = new URL(`${releaseBaseUrl}/`)
  const trustedPath = trustedReleaseBase.pathname.endsWith('/')
    ? trustedReleaseBase.pathname
    : `${trustedReleaseBase.pathname}/`
  if (
    resolvedAssetUrl.origin !== trustedReleaseBase.origin ||
    !resolvedAssetUrl.pathname.startsWith(trustedPath)
  ) {
    throw new Error(`Update metadata points to an untrusted asset URL from ${updateUrl}`)
  }
  return resolvedAssetUrl
}

export function normalizeReleaseMetadata(
  metadata: unknown,
  updateUrl: string,
  releaseBaseUrl: string,
  expectedChannel: UpdateChannel,
  fallbackAssetUrl: string,
): UpdateReleaseMetadata {
  const fields = readMetadataFields(metadata, updateUrl)
  validateMetadataFields(fields, updateUrl, expectedChannel)

  // protocolVersion/channel were added after the original channel manifests. Missing values are
  // intentionally accepted so the first robust updater can consume the previous release format.
  const resolvedAssetUrl = resolveTrustedAssetUrl(
    fields.assetUrl,
    releaseBaseUrl,
    fallbackAssetUrl,
    updateUrl,
  )

  return {
    version: fields.version,
    hash: fields.hash.toLowerCase(),
    assetUrl:
      typeof fields.assetUrl === 'string' && fields.assetUrl.length > 0
        ? resolvedAssetUrl.toString()
        : fallbackAssetUrl,
  }
}

export function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10))
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10))
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function isUpdateCandidate(
  currentVersion: string,
  release: ReleaseFingerprint,
  runningRelease: ReleaseFingerprint | null,
) {
  const versionDiff = compareVersions(release.version, currentVersion)
  if (versionDiff > 0) return true
  if (versionDiff < 0) return false

  return Boolean(
    runningRelease &&
      runningRelease.version === release.version &&
      runningRelease.hash !== release.hash,
  )
}

export function addCacheBust(url: string) {
  const parsed = new URL(url)
  parsed.searchParams.set('cacheBust', `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  return parsed.toString()
}
