import { randomUUID } from 'node:crypto'
import { cp, mkdir, readlink, symlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { readPackageManifest, resolvePackageRoot } from '@howaboua/howcode-sdk/node/plugin-metadata'

const packageName = /^(?:@[\w.-]+\/)?[\w.-]+$/
async function linkPackage(target: string, name: unknown, root: string) {
  if (
    typeof name !== 'string' ||
    !packageName.test(name) ||
    name.split('/').some((part) => part === '.' || part === '..')
  )
    throw new Error(`Invalid distribution package name: ${String(name)}`)
  const link = join(target, 'node_modules', name)
  await mkdir(join(link, '..'), { recursive: true })
  try {
    await symlink(root, link, 'dir')
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        'code' in error &&
        error.code === 'EEXIST' &&
        (await readlink(link)) === root
      )
    )
      throw error
  }
}

function optionalPeer(metadata: unknown) {
  return Boolean(
    metadata && typeof metadata === 'object' && 'optional' in metadata && metadata.optional,
  )
}

function dependencies(manifest: Record<string, unknown> & { peerDependenciesMeta?: unknown }) {
  const names = new Map<string, boolean>()
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const entries = manifest[field]
    if (entries === undefined) continue
    if (!entries || typeof entries !== 'object' || Array.isArray(entries))
      throw new Error(`Invalid distribution ${field}`)
    for (const name of Object.keys(entries)) names.set(name, field === 'optionalDependencies')
  }
  const peers = manifest.peerDependenciesMeta
  if (peers && typeof peers === 'object')
    for (const [name, metadata] of Object.entries(peers))
      if (optionalPeer(metadata)) names.set(name, true)
  return names
}

/** Copy resolved package graphs, including native builds, without retaining distribution links. */
export async function snapshotDistributionPackages(
  names: readonly string[],
  distributionDirectory: string,
  target: string,
): Promise<void> {
  const copied = new Map<string, string>()
  const copy = async (root: string): Promise<string> => {
    const previous = copied.get(root)
    if (previous) return previous
    const destination = join(target, 'closure', randomUUID())
    copied.set(root, destination)
    await cp(root, destination, {
      recursive: true,
      dereference: true,
      filter: (path) => basename(path) !== 'node_modules' && basename(path) !== '.git',
    })
    const manifest = await readPackageManifest(root)
    // Flattened closure directories must retain npm's self-resolution boundary.
    // Some packages import their own public name from nested entrypoints.
    await linkPackage(destination, manifest.name, destination)
    for (const [name, optional] of dependencies(manifest)) {
      let dependency: string
      try {
        dependency = await resolvePackageRoot(name, root)
      } catch (error) {
        if (
          optional &&
          error instanceof Error &&
          error.message === `Missing installed dependency ${name} from ${root}`
        )
          continue
        throw error
      }
      const dependencyRoot = await copy(dependency)
      await linkPackage(destination, name, dependencyRoot)
    }
    return destination
  }
  for (const name of names) {
    const root = await copy(await resolvePackageRoot(name, distributionDirectory))
    await linkPackage(target, name, root)
  }
}
