import { realpath } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  linkedDurablePackages,
  readPackageManifest,
  resolvePackageRoot,
} from '@howaboua/howcode-sdk/node/plugin-metadata'
import type { PackageRecord } from './state.ts'

const agents = '@howaboua/howcode-agents'
const board = '@howaboua/howcode-board'
const portableAgents = '@howaboua/pi-durable-agents'
const closureDirectory = /^[0-9a-f-]{36}$/

export type NamedPackageRecord = { record: PackageRecord; name: string | undefined; root: string }

async function isDistributionSnapshot(installed: NamedPackageRecord, sources: string) {
  if (!installed.record.location) return false
  const path = relative(
    join(sources, installed.record.location, 'closure'),
    await realpath(installed.root),
  )
  // Default snapshots own one immutable closure directory per resolved dependency.
  return closureDirectory.test(path)
}

/** The known Agents 0.5 -> standalone Board cutover, not an automatic package updater. */
export async function legacyBoardPackageReplacement(options: {
  installed: readonly NamedPackageRecord[]
  defaults: readonly string[]
  sources: string
  distributionDirectory: string
}): Promise<PackageRecord | undefined> {
  if (!options.defaults.includes(board)) return undefined
  const installed = options.installed.find((item) => item.name === agents)
  if (!installed) return undefined
  const linked = (await linkedDurablePackages(installed.root)).find(
    (dependency) => dependency.name === portableAgents,
  )
  if (linked?.version !== '0.5.0') return undefined
  const manifest = await readPackageManifest(installed.root)
  if (
    manifest.version !== '0.1.0' ||
    installed.record.source !== `npm:${agents}@0.1.0` ||
    !(await isDistributionSnapshot(installed, options.sources))
  )
    throw new Error(
      `Cannot add standalone Board beside ${installed.record.source}: its resolved Agents 0.5.0 already supplies Board. Update this explicitly chosen source to a standalone-Board-compatible adapter, or remove it, then restart. Its source and data were not changed.`,
    )
  const replacementRoot = await resolvePackageRoot(agents, options.distributionDirectory)
  const replacement = await readPackageManifest(replacementRoot)
  const replacementDependency = (await linkedDurablePackages(replacementRoot)).find(
    (item) => item.name === portableAgents,
  )
  if (
    replacement.name !== agents ||
    replacement.version !== '0.1.0' ||
    replacementDependency?.version !== '0.6.0'
  )
    throw new Error('The distribution cannot complete the known Agents 0.5.0/Board cutover.')
  return installed.record
}
