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
  reconcile(definitions: InstalledComponentDefinition[]): Promise<{
    pending: boolean
    errors: ReadonlyMap<string, string>
    active: ReadonlyMap<string, string>
  }>
}
export type ComponentReadiness =
  | { status: 'ready' }
  | { status: 'pending'; reason: string }
  | { status: 'failed'; error: string }
  | { status: 'not-component' }
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
  packageSource: string,
  source?: InstalledComponentSource,
  navigation?: boolean,
): Generation {
  return {
    root,
    definition,
    descriptor: {
      source: packageSource,
      id: definition.id,
      name: definition.name,
      revision: definition.revision,
      status: 'ready',
      renderer: Boolean(source),
      ...(navigation ? { navigation } : {}),
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
        source: generation.descriptor.source,
        name: generation.descriptor.name,
        revision: generation.descriptor.revision,
        status: 'pending',
        stage: 'idle',
        renderer: Boolean(generation.source),
        reason: 'Removal pending: waiting for active agent work or component requests to finish.',
        ...(generation.descriptor.navigation ? { navigation: true } : {}),
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
        source: generation.descriptor.source,
        name: generation.descriptor.name,
        revision: generation.descriptor.revision,
        status: 'error',
        error,
      },
    })
  }
}

async function optionalManifest(root: string, required: boolean) {
  try {
    return await readPackageManifest(root)
  } catch (error) {
    if (
      !required &&
      error instanceof Error &&
      'code' in error &&
      ['ENOENT', 'ENOTDIR'].includes(String(error.code))
    )
      return undefined
    throw error
  }
}

function componentMetadata(
  manifest: Awaited<ReturnType<typeof optionalManifest>>,
  root: string,
  required: boolean,
) {
  const metadata = manifest && howcodeMetadata(manifest, root)
  if (!metadata && required)
    throw new Error('The desired installed package is missing its howcode component metadata.')
  return metadata
}

function desiredIdentity(installed: InstalledPackage, id: string, active: Map<string, Generation>) {
  return {
    id,
    source: installed.source,
    revision: installed.revision ?? 'unversioned',
    // Failed metadata cannot rename the still-active renderer's catalog key.
    name: active.get(id)?.definition?.name ?? installed.name ?? installed.source,
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
    ? compileInstalledComponent(
        componentEntrypoint(root, definition.name, metadata.renderer),
        definition.name,
      )
    : undefined
}

function componentDefinitions(
  generations: Map<string, Generation>,
  active: Map<string, Generation>,
) {
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
    else {
      generation.descriptor = {
        id: definition.id,
        source: generation.descriptor.source,
        name: definition.name,
        revision: definition.revision,
        status: 'error',
        error: `Duplicate installed component identity: ${definition.name}`,
      }
      const current = active.get(definition.id)?.definition
      if (current && !definitions.some((item) => item.name === current.name))
        definitions.push(current)
    }
  }
  return definitions
}

function isPreparationError(generation: Generation) {
  return generation.descriptor.status === 'error' && !generation.rendererError
}

function rendererReadiness(generation: Generation): ComponentReadiness {
  if (!generation.source)
    return { status: 'failed', error: 'This package has no renderer contribution.' }
  if (generation.rendererError) return { status: 'failed', error: generation.rendererError }
  return generation.rendererAdmitted
    ? { status: 'ready' }
    : { status: 'pending', reason: 'Waiting for browser contribution admission.' }
}

function publishOutcome(
  next: Map<string, Generation>,
  definitions: InstalledComponentDefinition[],
  pending: boolean,
  errors: ReadonlyMap<string, string>,
) {
  for (const { id, name, revision } of definitions) {
    const generation = next.get(id)
    if (!generation || isPreparationError(generation)) continue
    const error = errors.get(id) ?? generation.rendererError
    const navigation = {
      source: generation.descriptor.source,
      ...(generation.descriptor.navigation ? { navigation: true } : {}),
    }
    if (error) generation.descriptor = { id, name, revision, ...navigation, status: 'error', error }
    else if (pending)
      generation.descriptor = {
        id,
        name,
        revision,
        status: 'pending',
        stage: 'idle',
        renderer: Boolean(generation.source),
        reason: 'Waiting for active agent work or component requests to finish.',
        ...navigation,
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
        ...navigation,
      }
    else
      generation.descriptor = {
        id,
        name,
        revision,
        status: 'ready',
        renderer: Boolean(generation.source),
        ...navigation,
      }
  }
}

function retainPreparedServices(next: Map<string, Generation>, active: Map<string, Generation>) {
  // Preparation has no retirement authority. Broken desired packages are not removals.
  for (const [id, generation] of next) {
    const current = active.get(id)
    if (!generation.definition && current?.definition) generation.definition = current.definition
  }
}

function activeGenerations(
  next: Map<string, Generation>,
  active: Map<string, Generation>,
  revisions: ReadonlyMap<string, string>,
) {
  const result = new Map<string, Generation>()
  for (const [id, revision] of revisions) {
    const candidate = next.get(id)
    const generation = candidate?.descriptor.revision === revision ? candidate : active.get(id)
    if (generation?.definition?.revision === revision) result.set(id, generation)
  }
  return result
}

function publishActiveRevisions(next: Map<string, Generation>, active: Map<string, Generation>) {
  for (const [id, generation] of next) {
    const current = active.get(id)
    const { activeRevision: retired, ...descriptor } = generation.descriptor
    generation.descriptor = {
      ...descriptor,
      ...(current ? { activeRevision: current.definition?.revision } : {}),
      ...(current?.descriptor.navigation ? { navigation: true } : {}),
    }
  }
}

/** Shares the package UI owner's inventory, watcher and serialization barrier. */
export function createInstalledComponents(lifecycle?: InstalledComponentLifecycle) {
  let generations = new Map<string, Generation>()
  let active = new Map<string, Generation>()
  let pending = false
  let serviceErrors: ReadonlyMap<string, string> = new Map()
  const prepare = async (
    installed: InstalledPackage,
    id: string,
  ): Promise<Generation | undefined> => {
    const identity = desiredIdentity(installed, id, active)
    try {
      const manifest = await optionalManifest(installed.root, active.has(id))
      const metadata = componentMetadata(manifest, installed.root, active.has(id))
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
      return readyGeneration(
        installed.root,
        definition,
        installed.source,
        source,
        metadata.navigation,
      )
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
          const id = identify(item.name ? `npm:${item.name}` : item.source)
          const previous = generations.get(id)
          const generation =
            previous?.root === item.root && previous.descriptor.revision === item.revision
              ? previous
              : await prepare(item, id)
          return { id, generation }
        }),
      )
      for (const { id, generation } of prepared) if (generation) next.set(id, generation)
      retainPreparedServices(next, active)
      const definitions = componentDefinitions(next, active)
      const outcome = await lifecycle?.reconcile(definitions)
      pending = outcome?.pending ?? false
      serviceErrors = outcome?.errors ?? new Map()
      const nextActive = activeGenerations(next, active, outcome?.active ?? new Map())
      publishOutcome(next, definitions, pending, outcome?.errors ?? new Map())
      if (pending) retainPendingRemovals(next, generations)
      retainFailedRemovals(next, generations, outcome?.errors ?? new Map())
      publishActiveRevisions(next, nextActive)
      active = nextActive
      generations = next
    },
    list() {
      return [...generations.values()].map((generation) => ({ ...generation.descriptor }))
    },
    readiness(source: string, revision: string, stage: 'service' | 'renderer'): ComponentReadiness {
      const generation = [...generations.values()].find(
        (item) => item.descriptor.source === source && item.descriptor.revision === revision,
      )
      if (!generation) return { status: 'not-component' }
      const { descriptor } = generation
      const error = serviceErrors.get(descriptor.id)
      if (error) return { status: 'failed', error }
      if (isPreparationError(generation) && descriptor.status === 'error')
        return { status: 'failed', error: descriptor.error }
      if (active.get(descriptor.id)?.definition?.revision !== revision)
        return {
          status: 'pending',
          reason: 'Waiting for the exact service generation to activate.',
        }
      if (stage === 'service') return { status: 'ready' }
      return rendererReadiness(generation)
    },
    retirement(source: string, revision: string): ComponentReadiness {
      const generation = [...generations.values()].find(
        (item) => item.descriptor.source === source && item.descriptor.revision === revision,
      )
      if (generation) {
        const error = serviceErrors.get(generation.descriptor.id)
        if (error) return { status: 'failed', error }
      }
      return [...active.values()].some(
        (item) => item.descriptor.source === source && item.definition?.revision === revision,
      )
        ? { status: 'pending', reason: 'Waiting for the exact service generation to retire.' }
        : { status: 'ready' }
    },
    assertServiceReady() {
      for (const generation of generations.values()) {
        const { source, revision, name } = generation.descriptor
        const readiness = this.readiness(source, revision, 'service')
        if (readiness.status === 'failed')
          throw new Error(`Component service is unavailable: ${name}: ${readiness.error}`)
        if (readiness.status === 'pending')
          throw new Error(`Component service is not ready: ${name}: ${readiness.reason}`)
      }
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
      const { id, name, revision, navigation, source, activeRevision } = generation.descriptor
      generation.descriptor =
        request.error === undefined
          ? {
              id,
              source,
              name,
              revision,
              status: 'ready',
              renderer: true,
              navigation,
              activeRevision,
            }
          : { id, name, revision, source, activeRevision, status: 'error', error: request.error }
    },
    load(reference: PackageUiReference) {
      const current = active.get(reference.id)
      if (
        current?.definition?.revision === reference.revision &&
        current.source &&
        !current.rendererError
      )
        return current.source
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
