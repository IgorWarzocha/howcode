import { howcodeMetadata, readPackageManifest } from '@howaboua/howcode-sdk/node/plugin-metadata'
import type {
  PluginHostContribution,
  PluginServiceContribution,
} from '@howaboua/howcode-sdk/plugins'
import type {
  InstalledComponentAdmission,
  InstalledComponentDescriptor,
  InstalledComponentSource,
} from '../../../shared/installed-component-contracts.ts'
import type { PackageUiReference } from '../../../shared/package-ui-contracts.ts'
import { compileInstalledComponent } from './component-compiler.ts'
import {
  componentEntrypoint,
  type InstalledComponentDefinition,
  loadComponentContribution,
} from './component-loader.ts'
import type { InstalledPackage } from './manager.ts'

export type InstalledComponentLifecycle = {
  reconcile(
    definitions: InstalledComponentDefinition[],
  ): Promise<{ pending: boolean; errors: ReadonlyMap<string, string> }>
}
type Generation = {
  root: string
  descriptor: InstalledComponentDescriptor
  definition?: InstalledComponentDefinition
  source?: InstalledComponentSource
  rendererAdmitted?: boolean
  rendererError?: string
}
function readyGeneration(
  root: string,
  definition: InstalledComponentDefinition,
  source?: InstalledComponentSource,
): Generation {
  return {
    root,
    definition,
    descriptor: {
      id: definition.id,
      name: definition.name,
      revision: definition.revision,
      status: 'ready',
      renderer: Boolean(source),
    },
    ...(source ? { source } : {}),
  }
}

function retainPendingRemovals(next: Map<string, Generation>, previous: Map<string, Generation>) {
  for (const [id, generation] of previous) {
    if (next.has(id)) continue
    next.set(id, {
      ...generation,
      descriptor: {
        id,
        name: generation.descriptor.name,
        revision: generation.descriptor.revision,
        status: 'pending',
        stage: 'idle',
        renderer: Boolean(generation.source),
        reason: 'Removal pending: waiting for active agent work or component requests to finish.',
      },
    })
  }
}

function retainFailedRemovals(
  next: Map<string, Generation>,
  previous: Map<string, Generation>,
  errors: ReadonlyMap<string, string>,
) {
  for (const [id, generation] of previous) {
    const error = errors.get(id)
    if (next.has(id) || !error) continue
    next.set(id, {
      ...generation,
      descriptor: {
        id,
        name: generation.descriptor.name,
        revision: generation.descriptor.revision,
        status: 'error',
        error,
      },
    })
  }
}

async function optionalManifest(root: string) {
  try {
    return await readPackageManifest(root)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      ['ENOENT', 'ENOTDIR'].includes(String(error.code))
    )
      return undefined
    throw error
  }
}

async function loadDefinition(
  root: string,
  definition: InstalledComponentDefinition,
  metadata: NonNullable<ReturnType<typeof howcodeMetadata>>,
) {
  if (metadata.service)
    definition.service = await loadComponentContribution<PluginServiceContribution>(
      componentEntrypoint(root, definition.name, metadata.service),
    )
  if (metadata.host)
    definition.host = await loadComponentContribution<PluginHostContribution>(
      componentEntrypoint(root, definition.name, metadata.host),
    )
  return metadata.renderer
    ? compileInstalledComponent(componentEntrypoint(root, definition.name, metadata.renderer))
    : undefined
}

function componentDefinitions(generations: Map<string, Generation>) {
  const counts = new Map<string, number>()
  for (const generation of generations.values()) {
    if (generation.definition)
      counts.set(generation.definition.name, (counts.get(generation.definition.name) ?? 0) + 1)
  }
  const definitions: InstalledComponentDefinition[] = []
  for (const generation of generations.values()) {
    const definition = generation.definition
    if (!definition) continue
    if (counts.get(definition.name) === 1) definitions.push(definition)
    else
      generation.descriptor = {
        id: definition.id,
        name: definition.name,
        revision: definition.revision,
        status: 'error',
        error: `Duplicate installed component identity: ${definition.name}`,
      }
  }
  return definitions
}

function publishOutcome(
  next: Map<string, Generation>,
  definitions: InstalledComponentDefinition[],
  pending: boolean,
  errors: ReadonlyMap<string, string>,
) {
  for (const { id, name, revision } of definitions) {
    const generation = next.get(id)
    if (!generation) continue
    const error = errors.get(id) ?? generation.rendererError
    if (error) generation.descriptor = { id, name, revision, status: 'error', error }
    else if (pending)
      generation.descriptor = {
        id,
        name,
        revision,
        status: 'pending',
        stage: 'idle',
        renderer: Boolean(generation.source),
        reason: 'Waiting for active agent work or component requests to finish.',
      }
    else if (generation.source && !generation.rendererAdmitted)
      generation.descriptor = {
        id,
        name,
        revision,
        status: 'pending',
        stage: 'renderer',
        renderer: true,
        reason: 'Renderer is prepared; waiting for browser contribution admission.',
      }
    else
      generation.descriptor = {
        id,
        name,
        revision,
        status: 'ready',
        renderer: Boolean(generation.source),
      }
  }
}

/** Shares the package UI owner's inventory, watcher and serialization barrier. */
export function createInstalledComponents(lifecycle?: InstalledComponentLifecycle) {
  let generations = new Map<string, Generation>()
  let pending = false
  const prepare = async (
    installed: InstalledPackage,
    id: string,
  ): Promise<Generation | undefined> => {
    const identity = {
      id,
      revision: installed.revision ?? 'unversioned',
      name: installed.name ?? installed.source,
    }
    try {
      const manifest = await optionalManifest(installed.root)
      const metadata = manifest && howcodeMetadata(manifest, installed.root)
      if (!metadata) return undefined
      if (!manifest || typeof manifest.name !== 'string' || !installed.revision)
        throw new Error('Full components require a package name and installation revision.')
      identity.name = manifest.name
      if (!lifecycle)
        throw new Error('The running host does not support full component activation.')
      const definition: InstalledComponentDefinition = {
        id,
        name: manifest.name,
        revision: installed.revision,
      }
      const source = await loadDefinition(installed.root, definition, metadata)
      return readyGeneration(installed.root, definition, source)
    } catch (error) {
      return {
        root: installed.root,
        descriptor: {
          ...identity,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }
  return {
    get pending() {
      return pending
    },
    async refresh(installed: InstalledPackage[], identify: (source: string) => string) {
      const next = new Map<string, Generation>()
      const prepared = await Promise.all(
        installed.map(async (item) => {
          const id = identify(item.source)
          const previous = generations.get(id)
          const generation =
            previous?.root === item.root && previous.descriptor.revision === item.revision
              ? previous
              : await prepare(item, id)
          return { id, generation }
        }),
      )
      for (const { id, generation } of prepared) if (generation) next.set(id, generation)
      const definitions = componentDefinitions(next)
      const outcome = await lifecycle?.reconcile(definitions)
      pending = outcome?.pending ?? false
      publishOutcome(next, definitions, pending, outcome?.errors ?? new Map())
      if (pending) retainPendingRemovals(next, generations)
      retainFailedRemovals(next, generations, outcome?.errors ?? new Map())
      generations = next
    },
    list() {
      return [...generations.values()].map((generation) => ({ ...generation.descriptor }))
    },
    admit(request: InstalledComponentAdmission) {
      const generation = generations.get(request.id)
      if (!generation || generation.descriptor.revision !== request.revision)
        throw new Error('Component renderer admission belongs to a retired generation.')
      if (
        !generation.source ||
        (generation.descriptor.status === 'pending' && generation.descriptor.stage !== 'renderer')
      )
        throw new Error('Component services are not ready for renderer admission.')
      if (generation.descriptor.status === 'error' && !generation.rendererError)
        throw new Error(generation.descriptor.error)
      generation.rendererAdmitted = request.error === undefined
      if (request.error === undefined) {
        delete generation.rendererError
      } else {
        generation.rendererError = request.error
      }
      const { id, name, revision } = generation.descriptor
      generation.descriptor =
        request.error === undefined
          ? { id, name, revision, status: 'ready', renderer: true }
          : { id, name, revision, status: 'error', error: request.error }
    },
    load(reference: PackageUiReference) {
      const generation = generations.get(reference.id)
      if (!generation || generation.descriptor.revision !== reference.revision)
        throw new Error('Component revision is no longer installed. Reload the catalog.')
      if (
        generation.descriptor.status === 'error' ||
        (generation.descriptor.status === 'pending' && generation.descriptor.stage !== 'renderer')
      )
        throw new Error(
          generation.descriptor.status === 'error'
            ? generation.descriptor.error
            : generation.descriptor.reason,
        )
      if (!generation.source) throw new Error('Component has no renderer contribution.')
      return generation.source
    },
  }
}
