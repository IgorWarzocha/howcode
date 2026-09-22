import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, constants, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'
import { addCacheBust } from './update-protocol'

const DOWNLOAD_TIMEOUT_MS = 5 * 60_000

export function retryUpdateTransport<T>(operation: () => Promise<T>) {
  return Effect.tryPromise({ try: operation, catch: (error) => error }).pipe(
    Effect.retry({ times: 2, schedule: Schedule.exponential(500, 2) }),
  )
}

export async function fetchJson(url: string, timeoutMs = 15_000) {
  return Effect.runPromise(
    retryUpdateTransport(async () => {
      const response = await fetch(addCacheBust(url), {
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
      return response.json() as Promise<unknown>
    }),
  )
}

export async function downloadFile(url: string, filePath: string) {
  await Effect.runPromise(
    retryUpdateTransport(async () => {
      const response = await fetch(addCacheBust(url), {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        cache: 'no-store',
      })
      if (!(response.ok && response.body)) {
        throw new Error(`HTTP ${response.status} while downloading ${url}`)
      }
      await mkdir(path.dirname(filePath), { recursive: true })
      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeReadableStream),
        createWriteStream(filePath),
      )
    }),
  )
}

export async function sha256File(filePath: string) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

export async function writeAtomicJson(filePath: string, value: unknown) {
  const temporaryFile = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await mkdir(path.dirname(filePath), { recursive: true })
  try {
    await writeFile(temporaryFile, JSON.stringify(value, null, 2))
    await rename(temporaryFile, filePath)
  } catch (error) {
    await rm(temporaryFile, { force: true }).catch(() => undefined)
    throw error
  }
}

export async function isExecutableFile(filePath: string) {
  try {
    if (!(await stat(filePath)).isFile()) return false
    if (process.platform !== 'win32') await access(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}
