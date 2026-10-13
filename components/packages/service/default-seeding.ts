import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readPackageManifest } from '@howaboua/howcode-sdk/node/plugin-metadata'

export async function installedSeedName(root: string): Promise<string | undefined> {
  try {
    const manifest = await readPackageManifest(root)
    return typeof manifest.name === 'string' ? manifest.name : undefined
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    )
      return undefined
    throw error
  }
}

export async function readSeededDefaults(directory: string): Promise<Set<string>> {
  const marker = join(directory, 'seeded-defaults.json')
  let seeded: unknown
  try {
    seeded = JSON.parse(await readFile(marker, 'utf8'))
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    return new Set()
  }
  if (!(Array.isArray(seeded) && seeded.every((name) => typeof name === 'string')))
    throw new Error(`Invalid default package seed settings: ${marker}`)
  return new Set<string>(seeded)
}

export async function writeSeededDefaults(directory: string, names: Set<string>): Promise<void> {
  const marker = join(directory, 'seeded-defaults.json')
  const temporary = `${marker}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify([...names], null, 2)}\n`, { flag: 'wx' })
    await rename(temporary, marker)
  } finally {
    await rm(temporary, { force: true })
  }
}
