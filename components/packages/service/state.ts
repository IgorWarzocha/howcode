import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import * as Schema from 'effect/Schema'
import { lock } from 'proper-lockfile'
import { PackageOperationReceiptSchema } from '../../../shared/package-operation-contracts.ts'

const managedLocation = /^[0-9a-f-]{36}$/

const PackageRecordSchema = Schema.Struct({
  source: Schema.String,
  name: Schema.optionalKey(Schema.String),
  location: Schema.optionalKey(Schema.String.check(Schema.isPattern(managedLocation))),
  revision: Schema.optionalKey(Schema.String),
})
export type PackageRecord = typeof PackageRecordSchema.Type
const PackageSettingsSchema = Schema.Struct({
  version: Schema.Literal(1),
  packages: Schema.mutable(Schema.Array(PackageRecordSchema)),
  operations: Schema.mutable(Schema.Array(PackageOperationReceiptSchema)),
  boardSelectionMigration: Schema.optionalKey(Schema.Literal(true)),
})
export type PackageSettings = typeof PackageSettingsSchema.Type

/** Call under the inventory barrier: acquiring it proves no prior mutation still owns an intent. */
export async function readPackageState(path: string): Promise<PackageSettings> {
  let contents: string
  try {
    contents = await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return { version: 1, packages: [], operations: [] }
    throw error
  }
  const value: unknown = JSON.parse(contents)
  const state = Array.isArray(value)
    ? {
        version: 1 as const,
        packages: Schema.decodeUnknownSync(Schema.mutable(Schema.Array(PackageRecordSchema)))(
          value,
        ),
        operations: [],
      }
    : Schema.decodeUnknownSync(PackageSettingsSchema)(value)
  if (!state.operations.some((operation) => operation.outcome === 'preparing')) return state
  const recovered: PackageSettings = {
    ...state,
    operations: state.operations.map((operation) =>
      operation.outcome === 'preparing'
        ? {
            ...operation,
            outcome: 'interrupted',
            error:
              'Package operation was interrupted before inventory commit; effects were not retried.',
          }
        : operation,
    ),
  }
  await writePackageState(path, recovered)
  return recovered
}

export async function readPackageSettings(path: string): Promise<PackageRecord[]> {
  return (await readPackageState(path)).packages
}

export async function writePackageState(path: string, state: PackageSettings): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx', flush: true })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

/** Inventory-only writers (including distribution seeding) must retain operation receipts. */
export async function writePackageSettings(path: string, records: PackageRecord[]): Promise<void> {
  const state = await readPackageState(path)
  await writePackageState(path, { ...state, packages: records })
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
