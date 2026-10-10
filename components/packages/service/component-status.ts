import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as Schema from 'effect/Schema'
import { InstalledComponentStatusSchema } from '../../../shared/installed-component-contracts.ts'

type Status = typeof InstalledComponentStatusSchema.Type
const filename = 'component-status.json'
export const componentStatusLeaseMs = 5000

function ownerIsLive(owner: Status['owner']) {
  if (owner.expiresAt <= Date.now()) return false
  try {
    process.kill(owner.pid, 0)
    return true
  } catch {
    return false
  }
}

export async function retireComponentStatus(directory: string, generation: string) {
  const path = join(directory, 'packages', filename)
  try {
    const status = Schema.decodeUnknownSync(InstalledComponentStatusSchema)(
      JSON.parse(await readFile(path, 'utf8')),
    )
    if (status.owner.generation === generation) await rm(path, { force: true })
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
}
export async function writeComponentStatus(directory: string, status: Status) {
  const path = join(directory, 'packages', filename)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(status), { flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

/** CLI observes the owning host; it never constructs a second component runtime. */
export async function waitComponentStatus(directory: string, source: string, revision?: string) {
  const deadline = Date.now() + 3000
  const observedLeases = new Map<string, number>()
  while (Date.now() < deadline) {
    try {
      const status = Schema.decodeUnknownSync(InstalledComponentStatusSchema)(
        JSON.parse(await readFile(join(directory, 'packages', filename), 'utf8')),
      )
      const previousLease = observedLeases.get(status.owner.generation)
      observedLeases.set(status.owner.generation, status.owner.expiresAt)
      const installed = status.inventory.find((item) => item.source === source)
      // Observe this generation publishing during this call, not just a recent
      // persisted timestamp or a PID that might have been reused after exit.
      if (
        previousLease !== undefined &&
        status.owner.expiresAt > previousLease &&
        ownerIsLive(status.owner) &&
        (revision ? installed?.revision === revision : !installed)
      )
        return status
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return undefined
}
