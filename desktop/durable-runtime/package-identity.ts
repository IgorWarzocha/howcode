import { createHash } from 'node:crypto'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { readPackageManifest, resolvePackageRoot } from '@howaboua/howcode-sdk/node/plugin-metadata'

function record(value: unknown): value is Record<string, unknown> & {
  peerDependenciesMeta?: unknown
  optional?: unknown
} {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function dependencyEntries(value: unknown, field: string, root: string) {
  if (value === undefined) return []
  if (!record(value)) throw new Error(`Invalid ${field}: ${root}`)
  for (const [name, version] of Object.entries(value))
    if (typeof version !== 'string') throw new Error(`Invalid dependency ${name}: ${root}`)
  return Object.keys(value)
}

function optionalPeers(value: unknown) {
  if (!record(value)) return []
  return Object.entries(value)
    .filter(([, options]) => record(options) && options.optional === true)
    .map(([name]) => name)
}

function dependencies(metadata: unknown, root: string) {
  if (!record(metadata)) throw new Error(`Invalid package manifest: ${root}`)
  const names = new Map<string, boolean>()
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of dependencyEntries(metadata[field], field, root))
      names.set(name, field === 'optionalDependencies')
  }
  for (const name of optionalPeers(metadata.peerDependenciesMeta))
    if (names.has(name)) names.set(name, true)
  return [...names].sort(([left], [right]) => left.localeCompare(right))
}

async function hashPayloadEntry(
  path: string,
  name: string,
  ancestors: Set<string>,
): Promise<string> {
  const info = await stat(path)
  if (info.isDirectory()) {
    return hashPayloadDirectory(path, name, ancestors)
  }
  if (!info.isFile()) throw new Error(`Unsupported package payload entry: ${path}`)
  const bytes = await readFile(path)
  return createHash('sha256')
    .update(JSON.stringify(['file', name, info.mode & 0o111, bytes.length]))
    .update(bytes)
    .digest('hex')
}

async function hashPayloadDirectory(
  directory: string,
  relative: string,
  ancestors: Set<string>,
): Promise<string> {
  const canonical = await realpath(directory)
  if (ancestors.has(canonical)) throw new Error(`Cyclic package payload directory: ${directory}`)
  const next = new Set(ancestors).add(canonical)
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))
  const children = await Promise.all(
    entries
      .filter((entry) => entry.name !== 'node_modules' && entry.name !== '.git')
      .map((entry) =>
        hashPayloadEntry(join(directory, entry.name), `${relative}/${entry.name}`, next),
      ),
  )
  return createHash('sha256')
    .update(JSON.stringify(['directory', relative, children]))
    .digest('hex')
}

/** Compare executable payloads and their resolved graph, not unpublished version labels.
 * Cache only within one inventory reconciliation: local package files may change later. */
export function createPackageIdentity(hostPackages: readonly string[]) {
  const nativeHosts = new Set(hostPackages)
  const payloads = new Map<string, Promise<string>>()
  const metadata = new Map<string, ReturnType<typeof readPackageManifest>>()
  const payload = (root: string) => {
    let pending = payloads.get(root)
    if (!pending) {
      pending = hashPayloadDirectory(root, '', new Set())
      payloads.set(root, pending)
    }
    return pending
  }
  const manifest = (root: string) => {
    let pending = metadata.get(root)
    if (!pending) {
      pending = readPackageManifest(root)
      metadata.set(root, pending)
    }
    return pending
  }
  const graph = async (root: string, ancestors: readonly string[]): Promise<string> => {
    const cycle = ancestors.indexOf(root)
    if (cycle !== -1) return JSON.stringify(['cycle', cycle])
    const [content, packageManifest] = await Promise.all([payload(root), manifest(root)])
    const links = await Promise.all(
      dependencies(packageManifest, root).map(
        async ([name, optional]): Promise<[string, string]> => {
          // These imports are deliberately rebound to this runtime's native host modules.
          if (nativeHosts.has(name)) {
            return [name, 'native-host']
          }
          let dependency: string
          try {
            dependency = await resolvePackageRoot(name, root)
          } catch (error) {
            if (
              optional &&
              error instanceof Error &&
              error.message === `Missing installed dependency ${name} from ${root}`
            ) {
              return [name, 'missing-optional']
            }
            throw error
          }
          return [name, await graph(dependency, [...ancestors, root])]
        },
      ),
    )
    return createHash('sha256')
      .update(JSON.stringify([content, links]))
      .digest('hex')
  }
  return (root: string) => graph(root, [])
}
