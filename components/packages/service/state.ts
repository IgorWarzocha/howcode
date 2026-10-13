import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { lock } from 'proper-lockfile'

const managedLocation = /^[0-9a-f-]{36}$/

export interface PackageRecord {
  source: string
  name?: string
  location?: string
  revision?: string
}

export async function readPackageSettings(path: string): Promise<PackageRecord[]> {
  let contents: string
  try {
    contents = await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
  const value: unknown = JSON.parse(contents)
  if (!Array.isArray(value)) throw new Error(`Invalid package settings: ${path}`)
  return value.map((record: unknown) => {
    if (
      typeof record !== 'object' ||
      record === null ||
      !('source' in record) ||
      typeof record.source !== 'string' ||
      ('name' in record && typeof record.name !== 'string') ||
      ('revision' in record && typeof record.revision !== 'string') ||
      ('location' in record &&
        (typeof record.location !== 'string' || !managedLocation.test(record.location)))
    ) {
      throw new Error(`Invalid package settings record: ${path}`)
    }
    return {
      source: record.source,
      ...('name' in record ? { name: String(record.name) } : {}),
      ...('revision' in record ? { revision: String(record.revision) } : {}),
      ...('location' in record ? { location: String(record.location) } : {}),
    }
  })
}

export async function writePackageSettings(path: string, records: PackageRecord[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, { flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

// Managers for the same app directory share one mutation and read barrier.
const queues = new Map<string, Promise<unknown>>()

export function serializePackageOperation<T>(
  directory: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(directory) ?? Promise.resolve()
  const result = previous
    .catch(() => undefined)
    .then(async () => {
      await mkdir(directory, { recursive: true })
      const release = await lock(directory, {
        retries: { retries: 60, minTimeout: 100, maxTimeout: 1000 },
        stale: 60_000,
      })
      try {
        return await operation()
      } finally {
        await release()
      }
    })
  queues.set(directory, result)
  void result
    .finally(() => {
      if (queues.get(directory) === result) queues.delete(directory)
    })
    .catch(() => undefined)
  return result
}
