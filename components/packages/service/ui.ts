import { createHash } from 'node:crypto'
import { watch } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import * as Schema from 'effect/Schema'
import { createJiti } from 'jiti'
import type {
  PackageUiBindingFactory,
  PackageUiDescriptor,
  PackageUiReference,
  PackageUiService,
} from '../../../shared/package-ui-contracts.ts'
import { PackageUiReferenceSchema } from '../../../shared/package-ui-schema.ts'
import {
  createPackageManager,
  type InstalledPackage,
  type PackageManagerOptions,
  packageMetadata,
} from './manager.ts'
import { parsePackageSource } from './source.ts'
import { createPackageUiBindings } from './ui-bindings.ts'
import { compilePackageUi } from './ui-compiler.ts'

export async function hasPackageUi(root: string): Promise<boolean> {
  try {
    return (await stat(join(root, 'ui.tsx'))).isFile()
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      ['ENOENT', 'ENOTDIR'].includes(String(error.code))
    )
      return false
    throw error
  }
}

type UiGeneration = {
  installed: InstalledPackage
  descriptor: PackageUiDescriptor
  js?: string
  controller: AbortController
  factory?: PackageUiBindingFactory
}

function validateReference(value: PackageUiReference) {
  Schema.decodeUnknownSync(PackageUiReferenceSchema)(value)
}

async function loadBinding(root: string): Promise<PackageUiBindingFactory | undefined> {
  const path = join(root, 'ui-binding.ts')
  try {
    await stat(path)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  }
  const loader = createJiti(import.meta.url, {
    interopDefault: false,
    tryNative: false,
    moduleCache: false,
    fsCache: false,
  })
  const loaded = await loader.import<{ createBinding?: unknown }>(path)
  if (typeof loaded.createBinding !== 'function')
    throw new Error('Package ui-binding.ts must export createBinding(context).')
  return loaded.createBinding as PackageUiBindingFactory
}

/** Directory watching survives the package manager's atomic settings-file rename. */
export async function createPackageUiService(
  options: PackageManagerOptions,
  invalidate: () => void,
): Promise<{ service: PackageUiService; dispose(): Promise<void> }> {
  const manager = createPackageManager(options)
  const packageId = (source: string) =>
    createHash('sha256').update(parsePackageSource(source, options.cwd).identity).digest('hex')
  const directory = join(options.directory, 'packages')
  await mkdir(directory, { recursive: true })
  let generations = new Map<string, UiGeneration>()
  let scanned = new Map<string, InstalledPackage>()
  let closed = false
  let watcherError: Error | undefined
  let queue: Promise<unknown> = Promise.resolve()
  const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = queue
      .catch(() => undefined)
      .then(async () => {
        if (closed) throw new Error('Package UI service is closed.')
        if (watcherError) throw watcherError
        return operation()
      })
    queue = next
    return next
  }
  const createGeneration = async (installed: InstalledPackage): Promise<UiGeneration> => {
    const descriptor: PackageUiDescriptor = {
      id: packageId(installed.source),
      revision: installed.revision ?? 'unversioned',
      name: installed.name ?? installed.source,
      status: 'ready',
    }
    const generation: UiGeneration = { installed, descriptor, controller: new AbortController() }
    if (installed.revision === undefined) {
      generation.descriptor = {
        ...descriptor,
        status: 'error',
        error: 'Package UI needs an installation revision. Run howcode update for this package.',
      }
      return generation
    }
    try {
      generation.js = await compilePackageUi(join(installed.root, 'ui.tsx'))
      const factory = await loadBinding(installed.root)
      if (factory) generation.factory = factory
    } catch (error) {
      generation.descriptor = {
        ...descriptor,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }
    }
    return generation
  }
  const generationFor = async (id: string, installed: InstalledPackage) => {
    const known = scanned.get(id)
    if (known?.root === installed.root && known.revision === installed.revision)
      return generations.get(id)
    return (await hasPackageUi(installed.root)) ? createGeneration(installed) : undefined
  }
  const inspectGeneration = async (id: string, installed: InstalledPackage) => {
    try {
      const metadata = await packageMetadata(installed.root, options.hostVersion)
      return await generationFor(id, { ...installed, ...metadata })
    } catch (error) {
      return {
        installed,
        controller: new AbortController(),
        descriptor: {
          id,
          revision: installed.revision ?? 'unversioned',
          name: installed.source,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      } satisfies UiGeneration
    }
  }
  const retireChanged = (identities: Map<string, InstalledPackage>) => {
    // Retirement depends on committed settings, never unrelated package availability.
    for (const [id, generation] of generations) {
      const current = identities.get(id)
      if (
        current?.root !== generation.installed.root ||
        current.revision !== generation.installed.revision
      )
        generation.controller.abort()
    }
  }
  const refresh = async () => {
    const installed = await manager.inventory()
    retireChanged(new Map(installed.map((item) => [packageId(item.source), item])))
    const next = new Map<string, UiGeneration>()
    const nextScanned = new Map<string, InstalledPackage>()
    const inspected = await Promise.all(
      installed.map(async (item) => {
        const id = packageId(item.source)
        return { id, item, generation: await inspectGeneration(id, item) }
      }),
    )
    for (const { id, item, generation } of inspected) {
      nextScanned.set(id, item)
      if (generation) next.set(id, generation)
    }
    for (const [id, generation] of generations) {
      if (next.get(id) !== generation) generation.controller.abort()
    }
    generations = next
    scanned = nextScanned
  }
  const current = async (reference: PackageUiReference) => {
    validateReference(reference)
    await refresh()
    const generation = generations.get(reference.id)
    if (!generation || generation.descriptor.revision !== reference.revision)
      throw new Error('Package UI revision is no longer installed. Reload the catalog.')
    if (generation.descriptor.status === 'error') throw new Error(generation.descriptor.error)
    return generation
  }
  const watcher = watch(directory, (_event, filename) => {
    if (filename !== null && String(filename) !== 'settings.json') return
    void serialized(refresh)
      .then(invalidate)
      .catch((error: unknown) => {
        if (closed) return
        console.error('Package UI inventory refresh failed.', error)
        invalidate()
      })
  })
  watcher.on('error', (error) => {
    watcherError = new Error('Package UI settings watcher failed.', { cause: error })
    console.error('Package UI settings watcher failed.', error)
    invalidate()
  })
  const bindings = createPackageUiBindings(async (request) => {
    const generation = await serialized(() => current(request))
    if (!generation.factory) throw new Error('Package UI has no ui-binding.ts factory.')
    return { factory: generation.factory, signal: generation.controller.signal }
  })
  const service: PackageUiService = {
    openPackageUiBinding: bindings.openPackageUiBinding,
    readPackageUiBindingEvents: bindings.readPackageUiBindingEvents,
    operatePackageUiBinding: bindings.operatePackageUiBinding,
    closePackageUiBinding: bindings.closePackageUiBinding,
    listPackageUis: () =>
      serialized(async () => {
        await refresh()
        return [...generations.values()].map((generation) => ({ ...generation.descriptor }))
      }),
    loadPackageUi: (reference) =>
      serialized(async () => {
        const generation = await current(reference)
        if (generation.js === undefined)
          throw new Error('Package UI compilation produced no module.')
        return { js: generation.js }
      }),
  }
  return {
    service,
    async dispose() {
      closed = true
      watcher.close()
      await queue.catch(() => undefined)
      for (const generation of generations.values()) generation.controller.abort()
      generations.clear()
      scanned.clear()
      await bindings.dispose()
    },
  }
}
