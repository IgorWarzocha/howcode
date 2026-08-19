const { randomUUID } = require('node:crypto')
const fsp = require('node:fs/promises')
const path = require('node:path')

const DEFAULT_STALE_MS = 30 * 60_000
const DEFAULT_HEARTBEAT_MS = 5_000
const DEFAULT_RETRY_MS = 500
const DEFAULT_ATTEMPTS = 120

async function readOwnerToken(lockPath) {
  try {
    const owner = JSON.parse(await fsp.readFile(path.join(lockPath, 'owner.json'), 'utf8'))
    return typeof owner.token === 'string' ? owner.token : null
  } catch {
    return null
  }
}

async function removeStaleLock(lockPath, staleMs) {
  try {
    if (Date.now() - (await fsp.stat(lockPath)).mtimeMs <= staleMs) return
    const stalePath = `${lockPath}.stale-${randomUUID()}`
    await fsp.rename(lockPath, stalePath)
    await fsp.rm(stalePath, { recursive: true, force: true })
  } catch {
    // The owner may have refreshed or released the lease after it was inspected.
  }
}

async function releaseOwnedLock(lockPath, token) {
  if ((await readOwnerToken(lockPath)) !== token) return
  const releasedPath = `${lockPath}.released-${token}`
  try {
    await fsp.rename(lockPath, releasedPath)
    await fsp.rm(releasedPath, { recursive: true, force: true })
  } catch {
    // Never remove a replacement lock owned by another process.
  }
}

async function heartbeatOwnedLock(lockPath, token) {
  try {
    if ((await readOwnerToken(lockPath)) !== token) return
    const now = new Date()
    await fsp.utimes(lockPath, now, now)
  } catch {
    // Release or stale-lock recovery may race the heartbeat.
  }
}

async function withUpdateLock(cacheRoot, operation, options = {}) {
  const lockPath = path.join(cacheRoot, '.update.lock')
  const token = randomUUID()
  const attempts = options.attempts || DEFAULT_ATTEMPTS
  const retryMs = options.retryMs || DEFAULT_RETRY_MS
  const staleMs = options.staleMs || DEFAULT_STALE_MS
  const heartbeatMs = options.heartbeatMs || DEFAULT_HEARTBEAT_MS
  await fsp.mkdir(cacheRoot, { recursive: true })

  let acquired = false
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fsp.mkdir(lockPath)
      try {
        await fsp.writeFile(
          path.join(lockPath, 'owner.json'),
          JSON.stringify({ token, pid: process.pid, acquiredAt: new Date().toISOString() }),
        )
      } catch (error) {
        await fsp.rm(lockPath, { recursive: true, force: true }).catch(() => undefined)
        throw error
      }
      acquired = true
      break
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      await removeStaleLock(lockPath, staleMs)
      await new Promise((resolve) => setTimeout(resolve, retryMs))
    }
  }
  if (!acquired) throw new Error('Another Howcode update is still running. Try again shortly.')

  const heartbeat = setInterval(() => {
    void heartbeatOwnedLock(lockPath, token)
  }, heartbeatMs)
  heartbeat.unref()
  try {
    return await operation()
  } finally {
    clearInterval(heartbeat)
    await releaseOwnedLock(lockPath, token)
  }
}

module.exports = { withUpdateLock }
