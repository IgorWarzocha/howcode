import { glob, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import { createRegistry, type Extension, type Harness } from '@earendil-works/pi-durable'
import {
  howcodeMetadata,
  linkedDurablePackages,
  resolvePackageRoot,
} from '@howaboua/howcode-sdk/node/plugin-metadata'
import { createJiti } from 'jiti'
import {
  createPackageManager,
  hasPackageUi,
  type InstalledPackage,
} from '../../components/packages/service/index.ts'
import { installedHowcodePackages } from './installed-durable.generated.ts'

const hostPackages = [
  '@earendil-works/pi-durable',
  '@earendil-works/chord',
  '@earendil-works/pi-ai',
]
const wildcardKey = /\/\*$/
const wildcardTarget = /\/\*.*$/
const extensionFile = /\.(?:[cm]?[jt]s)$/
type RecordValue = Record<string, unknown> & {
  version?: unknown
  exports?: unknown
  import?: unknown
  default?: unknown
  name?: unknown
  pi?: unknown
  extensions?: unknown
  main?: unknown
  createNotebookMode?: unknown
  createNodeShellBackend?: unknown
}
function record(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function manifest(root: string): Promise<RecordValue> {
  try {
    const value: unknown = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    if (!record(value)) throw new Error(`Invalid package.json: ${root}`)
    return value
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    )
      return {}
    throw error
  }
}

/** Resolve public subpaths to host files before Jiti evaluates package code. Native
 * loading preserves the same module identities used by the host's ESM imports. */
function exportTarget(value: unknown): unknown {
  return typeof value === 'string'
    ? value
    : record(value)
      ? (value.import ?? value.default)
      : undefined
}

export async function getDurableHostVersion(): Promise<string> {
  const entry = fileURLToPath(import.meta.resolve('@earendil-works/pi-durable'))
  const metadata = await manifest(dirname(dirname(entry)))
  if (typeof metadata.version !== 'string')
    throw new Error('Cannot determine host Pi Durable version.')
  return metadata.version
}

async function hostLoader() {
  const alias: Record<string, string> = {}
  const hosts = await Promise.all(
    hostPackages.map(async (name) => {
      const entry = fileURLToPath(import.meta.resolve(name))
      const root = dirname(dirname(entry))
      return { name, entry, root, metadata: await manifest(root) }
    }),
  )
  for (const { name, entry, root, metadata } of hosts) {
    if (record(metadata.exports)) {
      for (const [subpath, conditions] of Object.entries(metadata.exports)) {
        const target = exportTarget(conditions)
        if (typeof target !== 'string') continue
        const key = subpath === '.' ? name : `${name}/${subpath.slice(2)}`
        alias[key.replace(wildcardKey, '')] = resolve(root, target.replace(wildcardTarget, ''))
      }
    }
    alias[name] = entry
  }
  return {
    hostVersion: await getDurableHostVersion(),
    loader: createJiti(import.meta.url, {
      alias,
      nativeModules: hostPackages,
      interopDefault: false,
      tryNative: false,
      moduleCache: false,
      fsCache: false,
    }),
  }
}

function extension(value: unknown): value is Extension {
  return (
    record(value) &&
    typeof value.name === 'string' &&
    Object.keys(value).every((key) =>
      ['name', 'tools', 'sections', 'hooks', 'wraps', 'tasks'].includes(key),
    )
  )
}

async function configuredEntrypoints(root: string, paths: string[]): Promise<string[]> {
  const include = paths.filter((path) => !path.startsWith('!'))
  const exclude = paths.filter((path) => path.startsWith('!')).map((path) => path.slice(1))
  const matches: string[] = []
  for await (const path of glob(include, { cwd: root, exclude })) {
    const absolute = resolve(root, path)
    if ((await stat(absolute)).isFile()) matches.push(absolute)
  }
  if (matches.length === 0) throw new Error(`No extension files matched pi.extensions in ${root}`)
  return [...new Set(matches)].sort()
}

async function defaultEntrypoints(root: string, target: unknown): Promise<string[]> {
  if (target === undefined && (await hasPackageUi(root))) {
    try {
      await stat(join(root, 'index.js'))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
  }
  return [resolve(root, typeof target === 'string' ? target : 'index.js')]
}

async function entrypoints(root: string, metadata: RecordValue): Promise<string[]> {
  if ((await stat(root)).isFile()) return [root]
  const pi = metadata.pi
  if (record(pi) && 'extensions' in pi) {
    if (!(Array.isArray(pi.extensions) && pi.extensions.every((path) => typeof path === 'string')))
      throw new Error(`Invalid pi.extensions in ${root}`)
    return configuredEntrypoints(root, pi.extensions)
  }
  try {
    const entries = await readdir(join(root, 'extensions'), { withFileTypes: true })
    const paths = entries
      .filter((entry) => entry.isFile() && extensionFile.test(entry.name))
      .map((entry) => join(root, 'extensions', entry.name))
      .sort()
    if (paths.length > 0) return paths
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  const exports = metadata.exports
  const primary = record(exports) && '.' in exports ? exports['.'] : exports
  const target = exportTarget(primary) ?? metadata.main
  return defaultEntrypoints(root, target)
}

interface NotebookAdapter {
  extension: Extension
  bind(harness: Harness): void
  close(): Promise<void>
}
type NotebookFactory = (options: {
  stateDirectory: string
  native: { environmentId: string }
  shell: { backend: unknown }
  cancelTask: Harness['abortTask']
}) => NotebookAdapter

export interface PackageLoadOptions {
  directory: string
  cwd: string
  stateDirectory: string
  environmentId: string
}

function createNotebook(
  loaded: RecordValue,
  options: PackageLoadOptions,
  cancelTask: Harness['abortTask'],
): NotebookAdapter {
  if (
    typeof loaded.createNotebookMode !== 'function' ||
    typeof loaded.createNodeShellBackend !== 'function'
  )
    throw new Error('Notebook package lacks its public factories.')
  return (loaded.createNotebookMode as NotebookFactory)({
    stateDirectory: options.stateDirectory,
    native: { environmentId: options.environmentId },
    shell: { backend: loaded.createNodeShellBackend({ environmentId: options.environmentId }) },
    cancelTask,
  })
}

function exportedExtensions(loaded: RecordValue, path: string, linked = false): Extension[] {
  const candidates = extension(loaded.default)
    ? [loaded.default]
    : [...new Set(Object.values(loaded).filter(extension))]
  if (candidates.length === 0 && !linked)
    throw new Error(`No supported Durable Extension export in ${path}`)
  return candidates
}

async function closeNotebooks(notebooks: NotebookAdapter[]) {
  const results = await Promise.allSettled(notebooks.map((notebook) => notebook.close()))
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (errors.length > 0) throw new AggregateError(errors, 'Failed to close installed packages.')
}

type DurablePackage = InstalledPackage & { linked?: boolean }
interface LoadedPackage {
  installed: DurablePackage
  extensions: Extension[]
  notebooks: NotebookAdapter[]
}

async function durablePackageClosure(installed: InstalledPackage[]): Promise<DurablePackage[]> {
  const configured: InstalledPackage[] = await Promise.all(
    installedHowcodePackages.map(async (name) => ({
      source: `howcode:${name}`,
      kind: 'local' as const,
      root: await resolvePackageRoot(name, dirname(fileURLToPath(import.meta.url))),
      name,
    })),
  )
  const result: DurablePackage[] = []
  const roots = new Map<string, string>()
  const add = (item: DurablePackage) => {
    if (item.name) {
      const previous = roots.get(item.name)
      if (previous && previous !== item.root)
        throw new Error(`Multiple resolved identities for Durable package ${item.name}`)
      if (previous) return
      roots.set(item.name, item.root)
    }
    result.push(item)
  }
  const closures = await Promise.all(
    [...configured, ...installed].map(async (owner): Promise<DurablePackage[]> => {
      if ((await stat(owner.root)).isFile()) return [owner]
      const metadata = await manifest(owner.root)
      const howcode = howcodeMetadata(metadata, owner.root)
      const entries: DurablePackage[] = !howcode || metadata.pi !== undefined ? [owner] : []
      if (!howcode) return entries
      const linked = await linkedDurablePackages(owner.root)
      return entries.concat(
        linked.map((dependency) => ({
          ...dependency,
          linked: true,
          kind: owner.kind,
          source: `${owner.source}#${dependency.name}`,
          ...(owner.revision === undefined ? {} : { revision: owner.revision }),
        })),
      )
    }),
  )
  for (const closure of closures) {
    for (const item of closure) add(item)
  }
  return result
}

/** Incremental package generations. Retired resources stay alive until shutdown:
 * yielded notebook cells and old task phases may still own their definitions. */
export async function loadInstalledPackages(options: PackageLoadOptions) {
  const manager = createPackageManager({ ...options, hostVersion: await getDurableHostVersion() })
  let active: LoadedPackage[] = []
  const retained: LoadedPackage[] = []
  let harness: Harness | undefined
  let queue: Promise<unknown> = Promise.resolve()
  let closed = false
  const cancelTask: Harness['abortTask'] = (id, context) => {
    if (!harness) throw new Error('Notebook runtime is not bound.')
    return harness.abortTask(id, context)
  }
  const allExtensions = (packages: LoadedPackage[]) => packages.flatMap((item) => item.extensions)
  const busyNotebooks = async () => {
    const tasks = harness ? (await harness.inspect(BACKGROUND_CONTEXT)).tasks : []
    return active.filter(
      (item) =>
        item.notebooks.length > 0 &&
        item.extensions.some((candidate) =>
          candidate.tasks?.some((definition) =>
            tasks.some((task) => task.record.kind === definition.definition.name),
          ),
        ),
    )
  }
  const load = async (installed: DurablePackage): Promise<LoadedPackage> => {
    const [{ loader }, metadata] = await Promise.all([hostLoader(), manifest(installed.root)])
    const paths = await entrypoints(installed.root, metadata)
    const modules = await Promise.all(
      paths.map(async (path) => ({
        path,
        loaded: await loader.import<RecordValue>(path),
      })),
    )
    const item: LoadedPackage = { installed, extensions: [], notebooks: [] }
    try {
      for (const { path, loaded } of modules) {
        if (installed.name === '@howaboua/pi-durable-notebook') {
          const notebook = createNotebook(loaded, options, cancelTask)
          item.notebooks.push(notebook)
          item.extensions.push(notebook.extension)
          if (harness) notebook.bind(harness)
        } else item.extensions.push(...exportedExtensions(loaded, path, installed.linked))
      }
      return item
    } catch (error) {
      await closeNotebooks(item.notebooks)
      throw error
    }
  }
  const buildNext = async (installed: DurablePackage[], created: LoadedPackage[]) => {
    const busy = new Set(await busyNotebooks())
    const next: LoadedPackage[] = []
    for (const source of installed) {
      const previous = active.find(
        (candidate) =>
          candidate.installed.source === source.source &&
          (busy.has(candidate) ||
            (candidate.installed.root === source.root &&
              candidate.installed.revision === source.revision)),
      )
      const item = previous ?? (await load(source))
      if (!previous) created.push(item)
      next.push(item)
    }
    return next
  }
  const preserveBusy = (next: LoadedPackage[], busy: LoadedPackage[]) => {
    for (const item of busy) {
      const index = next.findIndex(
        (candidate) => candidate.installed.source === item.installed.source,
      )
      if (index === -1) next.splice(Math.min(active.indexOf(item), next.length), 0, item)
      else next[index] = item
    }
  }
  const validate = (candidates: Extension[]) => {
    const validation = createRegistry()
    const names = new Set<string>()
    for (const candidate of candidates) {
      if (names.has(candidate.name))
        throw new Error(`Duplicate installed extension: ${candidate.name}`)
      names.add(candidate.name)
      validation.install(candidate)
    }
  }
  const refresh = (
    publish: (extensions: Extension[]) => void = () => {
      /* Initial load has no host registry yet. */
    },
  ) => {
    const result = queue
      .catch(() => undefined)
      .then(async () => {
        if (closed) throw new Error('Installed packages are closed.')
        const installed = await durablePackageClosure(await manager.resolve())
        const created: LoadedPackage[] = []
        try {
          // Sequential construction makes partial failure cleanup deterministic.
          const next = await buildNext(installed, created)
          // Recheck after imports: another conversation may have admitted a cell.
          // Publication is synchronous from this point, before another phase runs.
          preserveBusy(next, await busyNotebooks())
          if (
            next.length === active.length &&
            next.every((item, index) => item === active[index])
          ) {
            retained.push(...created)
            return false
          }
          const extensions = allExtensions(next)
          validate(extensions)
          // Host validates built-in collisions before publishing synchronously.
          publish(extensions)
          const selected = new Set(next)
          retained.push(...active.filter((item) => !selected.has(item)))
          retained.push(...created.filter((item) => !selected.has(item)))
          active = next
          return true
        } catch (error) {
          try {
            await closeNotebooks(created.flatMap((item) => item.notebooks))
          } catch (cleanup) {
            throw new AggregateError([error, cleanup], 'Package reload and cleanup failed.')
          }
          throw error
        }
      })
    queue = result
    return result
  }
  await refresh()
  return {
    get extensions() {
      return allExtensions(active)
    },
    refresh,
    async close() {
      closed = true
      await queue.catch(() => undefined)
      await closeNotebooks([...active, ...retained].flatMap((item) => item.notebooks))
    },
    bind(runtime: Harness) {
      harness = runtime
      for (const item of active) for (const notebook of item.notebooks) notebook.bind(runtime)
    },
  }
}
