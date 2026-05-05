import { Buffer } from 'node:buffer'

export type DownloadMetadata = {
  contentLength: number | null
  etag: string | null
  etagSource: 'etag' | 'x-linked-etag' | null
}

export type DownloadChecksumExpectation = {
  algorithm: 'sha1' | 'sha256'
  expected: string
  prefix: Buffer | null
}

const MAX_DOWNLOAD_REDIRECTS = 20
const sha1EtagPattern = /^[a-f0-9]{40}$/i
const sha256EtagPattern = /^[a-f0-9]{64}$/i
const weakEtagPrefixPattern = /^W\//
const etagQuotePattern = /^"|"$/g

function isHashCapableEtag(etag: string | null) {
  return Boolean(etag && (sha1EtagPattern.test(etag) || sha256EtagPattern.test(etag)))
}

function getEtagSourcePriority(source: DownloadMetadata['etagSource']) {
  if (source === 'x-linked-etag') {
    return 2
  }

  if (source === 'etag') {
    return 1
  }

  return 0
}

function normalizeEtag(etag: string | null) {
  if (!etag) {
    return null
  }

  return (
    etag.replace(weakEtagPrefixPattern, '').replace(etagQuotePattern, '').trim().toLowerCase() ||
    null
  )
}

function parseContentLength(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function getDownloadMetadataFromHeaders(headers: Headers): DownloadMetadata {
  const xLinkedEtag = normalizeEtag(headers.get('x-linked-etag'))
  const etag = normalizeEtag(headers.get('etag'))

  return {
    contentLength: parseContentLength(headers.get('x-linked-size')),
    etag: isHashCapableEtag(xLinkedEtag) ? xLinkedEtag : isHashCapableEtag(etag) ? etag : null,
    etagSource: isHashCapableEtag(xLinkedEtag)
      ? 'x-linked-etag'
      : isHashCapableEtag(etag)
        ? 'etag'
        : null,
  }
}

export function getDownloadChecksumExpectations(
  etag: string | null,
  contentLength: number,
): DownloadChecksumExpectation[] {
  if (!etag) {
    return []
  }

  if (sha256EtagPattern.test(etag)) {
    return [{ algorithm: 'sha256', expected: etag, prefix: null }]
  }

  if (sha1EtagPattern.test(etag)) {
    return [
      { algorithm: 'sha1', expected: etag, prefix: null },
      {
        algorithm: 'sha1',
        expected: etag,
        prefix: Buffer.from(`blob ${contentLength}\0`),
      },
    ]
  }

  return []
}

function mergeDownloadMetadata(
  current: DownloadMetadata,
  headers: Headers,
  options: { includeContentLength: boolean },
): DownloadMetadata {
  const next = getDownloadMetadataFromHeaders(headers)
  const fallbackContentLength = options.includeContentLength
    ? parseContentLength(headers.get('content-length'))
    : null
  const shouldUseNextEtag =
    getEtagSourcePriority(next.etagSource) > getEtagSourcePriority(current.etagSource) ||
    (next.etag !== null && next.etagSource === current.etagSource)

  return {
    contentLength: current.contentLength ?? next.contentLength ?? fallbackContentLength,
    etag: shouldUseNextEtag ? next.etag : current.etag,
    etagSource: shouldUseNextEtag ? next.etagSource : current.etagSource,
  }
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

export async function fetchDownloadResponse(url: string) {
  let currentUrl = url
  let metadata: DownloadMetadata = {
    contentLength: null,
    etag: null,
    etagSource: null,
  }

  for (let redirectCount = 0; redirectCount <= MAX_DOWNLOAD_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, { redirect: 'manual' })
    metadata = mergeDownloadMetadata(metadata, response.headers, {
      includeContentLength: !isRedirectStatus(response.status),
    })

    if (!isRedirectStatus(response.status)) {
      if (!response.ok) {
        throw new Error(
          `Download failed (${response.status} ${response.statusText}) for ${currentUrl}`,
        )
      }

      return {
        response,
        metadata,
      }
    }

    if (redirectCount === MAX_DOWNLOAD_REDIRECTS) {
      throw new Error(`Download failed: too many redirects for ${url}`)
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new Error(`Download failed: missing redirect location for ${currentUrl}`)
    }

    currentUrl = new URL(location, currentUrl).toString()
  }

  throw new Error(`Download failed: could not resolve ${url}`)
}
