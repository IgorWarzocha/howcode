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
import * as Schema from 'effect/Schema'
import { satisfies, valid, validRange } from 'semver'
import {
  type PackageMutationRequest,
  PackageMutationRequestSchema,
  type PackageOperationCaller,
  type PackageOperationReceipt,
  type PackageOperationTarget,
} from '../../../shared/package-operation-contracts.ts'
import { legacyBoardPackageReplacement } from './board-package-cutover.ts'
import { installedSeedName, readSeededDefaults, writeSeededDefaults } from './default-seeding.ts'
import { snapshotDistributionPackages } from './distribution-snapshot.ts'
import { type PackageMutationPlan, runPackageOperation } from './operation-storage.ts'
import { type PackageSource, parsePackageSource } from './source'
import {
  type PackageRecord,
  readPackageSettings,
  readPackageState,
  serializePackageOperation,
  writePackageState,
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
  /** Request identity is scoped by a trusted host caller, not by operation payload. */
  mutate(
    request: PackageMutationRequest,
    caller: PackageOperationCaller,
  ): Promise<PackageOperationReceipt>
  operation(id: string): Promise<PackageOperationReceipt | undefined>
  operations(): Promise<PackageOperationReceipt[]>
  /** Proof of the known bundled-Board inventory cutover, committed with its replacement. */
  requiresBoardSelectionMigration(): Promise<boolean>
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

function normalizedSource(argument: string, cwd: string): PackageSource {
  const parsed = parsePackageSource(argument, cwd)
  if (parsed.kind !== 'git') return parsed
  return {
    ...parsed,
    source: `git:${parsed.url}${parsed.ref === undefined ? '' : `@${parsed.ref}`}`,
  }
}

function operationTarget(record: PackageRecord): PackageOperationTarget {
  return {
    source: record.source,
    revision: record.revision ?? 'unversioned',
    ...(record.name === undefined ? {} : { name: record.name }),
  }
}

function requireCommitted(receipt: PackageOperationReceipt): void {
  if (receipt.outcome === 'failed' || receipt.outcome === 'interrupted')
    throw new Error(receipt.error)
  if (receipt.outcome !== 'committed') throw new Error(`Package operation is ${receipt.outcome}`)
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
    return [...retained, record]
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
  const prepareInstallation = async (record: PackageRecord): Promise<InstalledPackage> => {
    const source = parsePackageSource(record.source, cwd)
    if (source.kind !== 'local') {
      await requireBun()
      if (!record.location) throw new Error(`Managed source has no location: ${record.source}`)
      await mkdir(sources, { recursive: true })
      await installManaged(source, join(sources, record.location))
    }
    return describe(record)
  }
  const prepareMutation = (
    request: PackageMutationRequest,
    records: PackageRecord[],
  ): PackageMutationPlan<InstalledPackage[]> => {
    const source = normalizedSource(request.source, cwd)
    const selected = records.find(
      (record) => parsePackageSource(record.source, cwd).identity === source.identity,
    )
    if (request.kind === 'remove') {
      const targets = selected ? [operationTarget(selected)] : []
      return {
        targets,
        run: async () => ({
          packages: records.filter((item) => item !== selected),
          targets,
          value: [],
        }),
      }
    }
    const candidateSource =
      request.kind === 'update' && selected ? normalizedSource(selected.source, cwd) : source
    const candidate: PackageRecord = {
      source: candidateSource.source,
      revision: randomUUID(),
      ...(candidateSource.kind === 'local' ? {} : { location: randomUUID() }),
    }
    return {
      targets: [operationTarget(candidate)],
      run: async () => {
        if (request.kind === 'update' && !selected)
          throw new Error(`Package is not installed: ${request.source}`)
        const installed = await prepareInstallation(candidate)
        const record = {
          ...candidate,
          ...(installed.name === undefined ? {} : { name: installed.name }),
        }
        return {
          packages: await replaceRecords(records, record, source.identity),
          targets: [operationTarget(record)],
          value: [installed],
        }
      },
      // Only failed, unpublished roots are deleted; committed generations may still be in use.
      cleanup: () => cleanup(candidate),
    }
  }
  const mutate = (input: PackageMutationRequest, caller: PackageOperationCaller) => {
    const request = Schema.decodeUnknownSync(PackageMutationRequestSchema)(input)
    const normalized = { ...request, source: normalizedSource(request.source, cwd).source }
    return runPackageOperation(settings, normalized, caller, (records) =>
      prepareMutation(normalized, records),
    )
  }
  const legacyMutation = async (kind: PackageMutationRequest['kind'], source: string) => {
    const result = await mutate({ requestId: randomUUID(), kind, source }, { scope: 'legacy' })
    requireCommitted(result.receipt)
    if (result.value === undefined) throw new Error('Package mutation committed without a result')
    return { receipt: result.receipt, installed: result.value }
  }
  const list = () =>
    serialized(async () => Promise.all((await readPackageSettings(settings)).map(describe)))
  return {
    mutate: (request, caller) => serialized(async () => (await mutate(request, caller)).receipt),
    operation: (id) =>
      serialized(async () =>
        (await readPackageState(settings)).operations.find((operation) => operation.id === id),
      ),
    operations: () => serialized(async () => (await readPackageState(settings)).operations),
    requiresBoardSelectionMigration: () =>
      serialized(async () => (await readPackageState(settings)).boardSelectionMigration === true),
    seedDefaults: (names, distributionDirectory) =>
      serialized(async () => {
        const completed = await readSeededDefaults(directory)
        const pending = names.filter((name) => !completed.has(name))
        const records = await readPackageSettings(settings)
        const installed = await Promise.all(
          records.map(async (record) => {
            const root = identify(record).root
            return { record, root, name: await installedSeedName(root, record.name) }
          }),
        )
        const replacement = await legacyBoardPackageReplacement({
          installed,
          defaults: names,
          sources,
          distributionDirectory,
        })
        if (pending.length === 0 && !replacement) return
        const existing = new Set(installed.map((item) => item.name))
        const missing = pending.filter((name) => !existing.has(name))
        const snapshot = replacement ? [...missing, '@howaboua/howcode-agents'] : missing
        const location = randomUUID()
        const target = join(sources, location)
        try {
          await snapshotDistributionPackages(snapshot, distributionDirectory, target)
          const additions = await Promise.all(snapshot.map((name) => seedRecord(name, location)))
          const state = await readPackageState(settings)
          await writePackageState(settings, {
            ...state,
            packages: [...records.filter((record) => record !== replacement), ...additions],
            ...(replacement ? { boardSelectionMigration: true } : {}),
          })
        } catch (error) {
          await rm(target, { recursive: true, force: true })
          throw error
        }
        await writeSeededDefaults(directory, new Set([...completed, ...pending]))
      }),
    install: (source) =>
      serialized(async () => {
        const installed = (await legacyMutation('install', source)).installed[0]
        if (!installed) throw new Error('Package installation committed without a target')
        return installed
      }),
    list,
    inventory: () => serialized(async () => (await readPackageSettings(settings)).map(identify)),
    resolve: list,
    remove: (source) =>
      serialized(async () => (await legacyMutation('remove', source)).receipt.targets.length > 0),
    update: (argument) =>
      serialized(async () => {
        if (argument !== undefined) return (await legacyMutation('update', argument)).installed
        const records = await readPackageSettings(settings)
        const result: InstalledPackage[] = []
        // Each mutation commits the entire inventory/receipt envelope. Later updates must read
        // the prior commit; parallel plans would overwrite each other's inventory and receipts.
        for (const record of records)
          result.push(...(await legacyMutation('update', record.source)).installed)
        return result
      }),
  }
}
