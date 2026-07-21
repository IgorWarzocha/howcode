const fs = require('node:fs')
const fsp = require('node:fs/promises')
const crypto = require('node:crypto')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')
const { Readable, Transform } = require('node:stream')

const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000

async function retry(operation, attempts = 3) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
      }
    }
  }
  throw lastError
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = unitIndex === 0 || value >= 10 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function createDownloadProgressStream(input) {
  let downloadedBytes = 0
  let lastLoggedAt = 0
  return new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length
      input.onProgress(downloadedBytes)
      const now = Date.now()
      if (now - lastLoggedAt >= 1000) {
        lastLoggedAt = now
        const downloadedLabel = formatBytes(downloadedBytes)
        if (input.totalBytes > 0) {
          const percent = Math.min(100, (downloadedBytes / input.totalBytes) * 100)
          process.stdout.write(
            `\rDownloading howcode: ${downloadedLabel} / ${formatBytes(input.totalBytes)} (${percent.toFixed(0)}%)`,
          )
        } else {
          process.stdout.write(`\rDownloading howcode: ${downloadedLabel}`)
        }
      }
      callback(null, chunk)
    },
  })
}

async function downloadFileOnce(url, filePath, idleTimeoutMs) {
  const controller = new AbortController()
  let timedOut = false
  let idleTimeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, idleTimeoutMs)
  const resetIdleTimeout = () => {
    clearTimeout(idleTimeout)
    idleTimeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, idleTimeoutMs)
  }
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!(response.ok && response.body)) {
      throw new Error(`HTTP ${response.status} while downloading ${url}`)
    }
    const totalBytes = Number(response.headers.get('content-length')) || 0
    resetIdleTimeout()
    await fsp.mkdir(path.dirname(filePath), { recursive: true })
    await pipeline(
      Readable.fromWeb(response.body),
      createDownloadProgressStream({ totalBytes, onProgress: resetIdleTimeout }),
      fs.createWriteStream(filePath),
    )
    process.stdout.write('\n')
  } catch (error) {
    if (timedOut) {
      throw new Error(`Download stalled for ${Math.round(idleTimeoutMs / 1000)} seconds: ${url}`)
    }
    throw error
  } finally {
    clearTimeout(idleTimeout)
  }
}

async function downloadFile(url, filePath, idleTimeoutMs = DOWNLOAD_IDLE_TIMEOUT_MS) {
  return retry(async () => {
    await fsp.rm(filePath, { force: true })
    return downloadFileOnce(url, filePath, idleTimeoutMs)
  })
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  await pipeline(fs.createReadStream(filePath), hash)
  return hash.digest('hex')
}

module.exports = { downloadFile, retry, sha256File }
