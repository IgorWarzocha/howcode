import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'

const STALE_LOCK_MS = 30 * 60_000
const HEARTBEAT_MS = 5_000
const RETRY_MS = 500
const ACQUIRE_ATTEMPTS = 120

async function readOwnerToken(lockPath: string) {
  try {
    const owner = JSON.parse(await readFile(path.join(lockPath, 'owner.json'), 'utf8')) as {
      token?: unknown
    }
    return typeof owner.token === 'string' ? owner.token : null
  } catch {
    return null
  }
}

async function removeStaleLock(lockPath: string) {
  try {
    if (Date.now() - (await stat(lockPath)).mtimeMs <= STALE_LOCK_MS) return
    const stalePath = `${lockPath}.stale-${randomUUID()}`
    await rename(lockPath, stalePath)
    await rm(stalePath, { recursive: true, force: true })
  } catch {
    // The owner may have refreshed or released the lease after it was inspected.
  }
}

async function releaseOwnedLock(lockPath: string, token: string) {
  if ((await readOwnerToken(lockPath)) !== token) return
  const releasedPath = `${lockPath}.released-${token}`
  try {
    await rename(lockPath, releasedPath)
    await rm(releasedPath, { recursive: true, force: true })
  } catch {
    // Never remove a replacement lock owned by another process.
  }
}

async function heartbeatOwnedLock(lockPath: string, token: string) {
  try {
    if ((await readOwnerToken(lockPath)) !== token) return
    const now = new Date()
    await utimes(lockPath, now, now)
  } catch {
    // Release or stale-lock recovery may race the heartbeat.
  }
}

export async function withUpdateLock<T>(cacheRoot: string, operation: () => Promise<T>) {
  const lockPath = path.join(cacheRoot, '.update.lock')
  const token = randomUUID()
  await mkdir(cacheRoot, { recursive: true })

  let acquired = false
  for (let attempt = 0; attempt < ACQUIRE_ATTEMPTS; attempt += 1) {
    try {
      await mkdir(lockPath)
      try {
        await writeFile(
          path.join(lockPath, 'owner.json'),
          JSON.stringify({ token, pid: process.pid, acquiredAt: new Date().toISOString() }),
        )
      } catch (error) {
        await rm(lockPath, { recursive: true, force: true }).catch(() => undefined)
        throw error
      }
      acquired = true
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await removeStaleLock(lockPath)
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
    }
  }
  if (!acquired) throw new Error('Another Howcode update is still running. Try again shortly.')

  const heartbeat = setInterval(() => {
    void heartbeatOwnedLock(lockPath, token)
  }, HEARTBEAT_MS)
  heartbeat.unref()
  try {
    return await operation()
  } finally {
    clearInterval(heartbeat)
    await releaseOwnedLock(lockPath, token)
  }
}
