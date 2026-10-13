import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import {
  howcodeMetadata,
  linkedDurablePackages,
  resolvePackageRoot,
} from '@howaboua/howcode-sdk/node/plugin-metadata'
import { satisfies, valid, validRange } from 'semver'
import { installedSeedName, readSeededDefaults, writeSeededDefaults } from './default-seeding.ts'
import { snapshotDistributionPackages } from './distribution-snapshot.ts'
import { type PackageSource, parsePackageSource } from './source'
import {
  type PackageRecord,
  readPackageSettings,
  serializePackageOperation,
  writePackageSettings,
} from './state'

const run = promisify(execFile)
const extensionFileTypes = new Set(['.ts', '.js', '.mts', '.mjs', '.cts', '.cjs'])

export interface InstalledPackage {
  source: string
  kind: PackageSource['kind']
  /** Package directory or a single local extension file. */
  root: string
  name?: string
  version?: string
  /** Changes on explicit install/update, including local sources. */
  revision?: string
}

export interface PackageManagerOptions {
  /** Howcode app data directory. Never Pi's agent settings directory. */
  directory: string
  /** Base directory for local install and remove arguments. */
  cwd: string
  hostVersion?: string
}

export interface PackageManager {
  /** Register distribution defaults once; subsequent removals remain authoritative. */
  seedDefaults(names: readonly string[], distributionDirectory: string): Promise<void>
  /** Install trusted package code. Bun may run lifecycle scripts before compatibility validation. */
  install(source: string): Promise<InstalledPackage>
  remove(source: string): Promise<boolean>
  list(): Promise<InstalledPackage[]>
  /** Persisted identities and revisions, without reading package roots or metadata. */
  inventory(): Promise<InstalledPackage[]>
  update(source?: string): Promise<InstalledPackage[]>
  resolve(): Promise<InstalledPackage[]>
}

export async function packageMetadata(
  root: string,
  hostVersion: string | undefined,
): Promise<{ name?: string; version?: string }> {
  const info = await stat(root)
  if (!(info.isDirectory() || (info.isFile() && extensionFileTypes.has(extname(root))))) {
    throw new Error(`Package source is not a directory or JavaScript/TypeScript extension: ${root}`)
  }
  const manifestDirectory = info.isFile() ? dirname(root) : root
  let contents: string
  try {
    contents = await readFile(join(manifestDirectory, 'package.json'), 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {}
    throw error
  }
  const manifest: unknown = JSON.parse(contents)
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
    throw new Error(`Invalid package.json: ${root}`)
  checkPeerDependencies(manifest, root, hostVersion)
  howcodeMetadata(manifest, root)
  await linkedDurablePackages(manifestDirectory)
  return {
    ...('name' in manifest && typeof manifest.name === 'string' ? { name: manifest.name } : {}),
    ...('version' in manifest && typeof manifest.version === 'string'
      ? { version: manifest.version }
      : {}),
  }
}

function checkPeerDependencies(
  manifest: object,
  root: string,
  hostVersion: string | undefined,
): void {
  if ('peerDependencies' in manifest) {
    const peers = manifest.peerDependencies
    if (typeof peers !== 'object' || peers === null || Array.isArray(peers))
      throw new Error(`Invalid peerDependencies: ${root}`)
    if ('@earendil-works/pi-durable' in peers) {
      const range = peers['@earendil-works/pi-durable']
      if (typeof range !== 'string' || !validRange(range))
        throw new Error(`Invalid pi-durable peer range: ${root}`)
      if (hostVersion !== undefined && !satisfies(hostVersion, range))
        throw new Error(`Package ${root} requires pi-durable ${range}, host is ${hostVersion}`)
    }
  }
}

async function installManaged(
  source: Exclude<PackageSource, { kind: 'local' }>,
  target: string,
): Promise<string> {
  if (source.kind === 'npm') {
    await mkdir(target, { recursive: true })
    await writeFile(
      join(target, 'package.json'),
      JSON.stringify({
        private: true,
        dependencies: { [source.name]: source.spec.slice(source.name.length + 1) || 'latest' },
      }),
    )
    await run('bun', ['install', '--omit=peer'], { cwd: target })
    return join(target, 'node_modules', source.name)
  }
  await run('git', ['clone', '--', source.url, target])
  if (source.ref !== undefined) {
    await run('git', ['fetch', 'origin', source.ref], { cwd: target })
    await run('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: target })
  }
  try {
    await stat(join(target, 'package.json'))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return target
    throw error
  }
  await run('bun', ['install', '--omit=peer'], { cwd: target })
  return target
}

async function requireBun(): Promise<void> {
  try {
    await run('bun', ['--version'])
  } catch (error) {
    throw new Error(
      'Bun is required to install npm and git packages. Install Bun and ensure it is on PATH.',
      { cause: error },
    )
  }
}

export function createPackageManager(options: PackageManagerOptions): PackageManager {
  const directory = resolve(options.directory, 'packages')
  const cwd = resolve(options.cwd)
  const settings = join(directory, 'settings.json')
  const sources = join(directory, 'sources')
  if (options.hostVersion !== undefined && !valid(options.hostVersion))
    throw new Error(`Invalid host version: ${options.hostVersion}`)
  const serialized = <T>(operation: () => Promise<T>) =>
    serializePackageOperation(directory, operation)
  const rootOf = (record: PackageRecord, source: PackageSource) => {
    if (source.kind === 'local') {
      if (record.location !== undefined)
        throw new Error(`Local source has a managed location: ${record.source}`)
      return source.root
    }
    if (!record.location) throw new Error(`Managed source has no installation: ${record.source}`)
    const target = join(sources, record.location)
    return source.kind === 'npm' ? join(target, 'node_modules', source.name) : target
  }
  const identify = (record: PackageRecord): InstalledPackage => {
    const source = parsePackageSource(record.source, cwd)
    const root = rootOf(record, source)
    return {
      source: record.source,
      kind: source.kind,
      root,
      ...(record.name === undefined ? {} : { name: record.name }),
      ...(record.revision === undefined ? {} : { revision: record.revision }),
    }
  }
  const describe = async (record: PackageRecord): Promise<InstalledPackage> => {
    const installed = identify(record)
    return { ...installed, ...(await packageMetadata(installed.root, options.hostVersion)) }
  }
  const cleanup = async (record: PackageRecord) => {
    if (record.location) await rm(join(sources, record.location), { recursive: true, force: true })
  }
  const replaceRecords = async (
    records: PackageRecord[],
    record: PackageRecord,
    identity: string,
  ) => {
    const candidates = await Promise.all(
      records.map(async (item) => {
        if (parsePackageSource(item.source, cwd).identity === identity) return undefined
        const name = item.name ?? (await installedSeedName(identify(item).root))
        return record.name && name === record.name ? undefined : item
      }),
    )
    const retained = candidates.filter((item): item is PackageRecord => item !== undefined)
    await writePackageSettings(settings, [...retained, record])
  }
  const seedRecord = async (name: string, location: string): Promise<PackageRecord> => {
    const root = await resolvePackageRoot(name, join(sources, location))
    const metadata = await packageMetadata(root, options.hostVersion)
    if (metadata.name !== name || !metadata.version || !valid(metadata.version))
      throw new Error(`Invalid distribution default identity: ${name}`)
    return {
      source: `npm:${name}@${metadata.version}`,
      name,
      location,
      revision: randomUUID(),
    }
  }
  const install = async (argument: string): Promise<InstalledPackage> => {
    const source = parsePackageSource(argument, cwd)
    if (source.kind !== 'local') await requireBun()
    const records = await readPackageSettings(settings)
    const record: PackageRecord = {
      source: source.source,
      revision: randomUUID(),
      ...(source.kind === 'local' ? {} : { location: randomUUID() }),
    }
    let committed = false
    try {
      if (source.kind !== 'local' && record.location) {
        await mkdir(sources, { recursive: true })
        await installManaged(source, join(sources, record.location))
      }
      const installed = await describe(record)
      if (installed.name) record.name = installed.name
      await replaceRecords(records, record, source.identity)
      committed = true
      // Retain committed generations: another process may still lazily import
      // their files. Only failed, unpublished installations can be deleted here.
      return installed
    } catch (error) {
      // Cleanup only uncommitted installations. Committed roots must survive cleanup errors.
      if (!committed) await cleanup(record)
      throw error
    }
  }
  const list = () =>
    serialized(async () => Promise.all((await readPackageSettings(settings)).map(describe)))
  return {
    seedDefaults: (names, distributionDirectory) =>
      serialized(async () => {
        const completed = await readSeededDefaults(directory)
        const pending = names.filter((name) => !completed.has(name))
        if (pending.length === 0) return
        const records = await readPackageSettings(settings)
        const existing = new Set(
          await Promise.all(
            records.map((record) => record.name ?? installedSeedName(identify(record).root)),
          ),
        )
        const missing = pending.filter((name) => !existing.has(name))
        const location = randomUUID()
        const target = join(sources, location)
        let committed = false
        try {
          await snapshotDistributionPackages(missing, distributionDirectory, target)
          const additions = await Promise.all(missing.map((name) => seedRecord(name, location)))
          await writePackageSettings(settings, [...records, ...additions])
          committed = true
          for (const name of pending) completed.add(name)
          await writeSeededDefaults(directory, completed)
        } finally {
          if (!committed) await rm(target, { recursive: true, force: true })
        }
      }),
    install: (source) => serialized(() => install(source)),
    list,
    inventory: () => serialized(async () => (await readPackageSettings(settings)).map(identify)),
    resolve: list,
    remove: (argument) =>
      serialized(async () => {
        const identity = parsePackageSource(argument, cwd).identity
        const records = await readPackageSettings(settings)
        const record = records.find(
          (item) => parsePackageSource(item.source, cwd).identity === identity,
        )
        if (!record) return false
        await writePackageSettings(
          settings,
          records.filter((item) => item !== record),
        )
        return true
      }),
    update: (argument) =>
      serialized(async () => {
        const records = await readPackageSettings(settings)
        const identity =
          argument === undefined ? undefined : parsePackageSource(argument, cwd).identity
        const selected = records.filter(
          (item) =>
            identity === undefined || parsePackageSource(item.source, cwd).identity === identity,
        )
        if (identity !== undefined && selected.length === 0)
          throw new Error(`Package is not installed: ${argument}`)
        const result: InstalledPackage[] = []
        for (const record of selected) result.push(await install(record.source))
        return result
      }),
  }
}
