import {
  invokePluginRequest,
  type PluginServiceContribution,
  type PluginServiceHost,
  type PluginServiceInstance,
} from '@howaboua/howcode-sdk/plugins'
import type { InstalledComponentDefinition } from '../../components/packages/service/index.ts'
import { installedHostContributions } from './installed-hosts.generated.ts'
import { installedServiceContributions } from './installed-services.generated.ts'

let installedInstances: ReadonlyMap<string, PluginServiceInstance> = new Map()
let serviceGeneration = 0
export function installedPluginGeneration() {
  return serviceGeneration
}
export function installedAgentTools() {
  return [...installedInstances].flatMap(([plugin, instance]) =>
    (instance.tools ?? []).map((tool) => ({ plugin, tool })),
  )
}
export async function freezePluginTurn(conversationId: string) {
  await Promise.all(
    [...installedInstances.values()].map((instance) => instance.freezeTurn?.(conversationId)),
  )
}

export async function createInstalledPluginServices(
  host: PluginServiceHost,
  adapters: Record<
    string,
    (contribution: PluginServiceContribution, host: PluginServiceHost) => PluginServiceInstance
  > = {},
  transition: (operation: () => Promise<void>) => Promise<boolean> = async (operation) => {
    await operation()
    return true
  },
) {
  const instances = new Map<string, PluginServiceInstance>()
  const revisions = new Map<string, string>()
  const handlers = new Map<string, object>()
  const failures = new Map<string, string>()
  const definitionsByName = new Map<string, InstalledComponentDefinition>()
  const retirementFailures = new Map<
    string,
    { definition: InstalledComponentDefinition; error: string }
  >()
  let inFlight = 0
  const requests = new Set<Promise<unknown>>()
  const track = async <T>(operation: () => Promise<T>): Promise<T> => {
    inFlight += 1
    const pending = Promise.resolve().then(operation)
    requests.add(pending)
    try {
      return await pending
    } finally {
      requests.delete(pending)
      inFlight -= 1
    }
  }
  const outputListeners = new Set<() => void>()
  const activeHosts = new Map<string, Set<() => void>>()
  let closed = false
  const revokeHost = (name: string) => {
    const subscriptions = activeHosts.get(name)
    activeHosts.delete(name)
    for (const listener of subscriptions ?? []) outputListeners.delete(listener)
    subscriptions?.clear()
  }
  const closeInstances = () =>
    Promise.allSettled(
      [...instances.values()].map((instance) => Promise.resolve().then(() => instance.dispose())),
    )
  const createInstance = (name: string, contribution?: PluginServiceContribution) => {
    const subscriptions = new Set<() => void>()
    activeHosts.set(name, subscriptions)
    const active = () => !closed && activeHosts.get(name) === subscriptions
    const pluginHost = {
      ...(host.agent ? { agent: host.agent } : {}),
      outputs: {
        list: () => [...instances].filter(([, instance]) => instance.outputs).map(([id]) => id),
        get: (id: string) => instances.get(id)?.outputs,
        subscribe: (listener: () => void) => {
          if (!active()) throw new Error('Component service host is retired.')
          const receive = () => {
            if (active()) listener()
          }
          outputListeners.add(receive)
          subscriptions.add(receive)
          return () => {
            outputListeners.delete(receive)
            subscriptions.delete(receive)
          }
        },
      },
      publishEvent: (event: unknown) => {
        if (!active()) return
        host.publishEvent({ type: 'plugin-event', plugin: name, event })
        if (event && typeof event === 'object' && 'type' in event && event.type === 'outputs')
          for (const listener of outputListeners) listener()
      },
    }
    return contribution
      ? (adapters[name]?.(contribution, pluginHost) ?? contribution.create(pluginHost))
      : {
          requests: {},
          dispose() {
            /* Renderer-only components have no native resources. */
          },
        }
  }
  const builtins: InstalledComponentDefinition[] = Object.entries(
    installedServiceContributions,
  ).map(([name, service]) => ({
    id: name,
    name,
    revision: 'bundled',
    service,
    ...(Object.hasOwn(installedHostContributions, name)
      ? { host: installedHostContributions[name as keyof typeof installedHostContributions] }
      : {}),
  }))
  const install = (definition: InstalledComponentDefinition) => {
    const native = createInstance(definition.name, definition.service)
    if (!native || typeof native !== 'object' || typeof native.dispose !== 'function')
      throw new Error(`Invalid component service lifecycle: ${definition.name}`)
    const instance: PluginServiceInstance = {
      requests: native.requests,
      dispose: () => native.dispose(),
      ...(native.outputs ? { outputs: native.outputs } : {}),
      ...(native.freezeTurn
        ? {
            freezeTurn: async (id) => {
              await native.freezeTurn?.(id)
            },
          }
        : {}),
    }
    instances.set(definition.name, instance)
    definitionsByName.set(definition.name, definition)
    if (!native.requests || typeof native.requests !== 'object')
      throw new Error(`Invalid component service instance: ${definition.name}`)
    if (native.tools)
      instance.tools = native.tools.map((tool) => ({
        ...tool,
        execute: (input, context) =>
          track(async () => {
            if (closed || instances.get(definition.name) !== instance)
              throw new Error(
                'Plugin tool generation is retired. Refresh the installed extension selection.',
              )
            return tool.execute(input, context)
          }),
      }))
    revisions.set(definition.name, definition.revision)
    const request = async <Result>(method: string, payload: unknown): Promise<Result> =>
      (await invokePluginRequest(instance.requests, method, payload)) as Result
    const hostHandlers = definition.host?.create({ request }) ?? instance.requests
    validateHostHandlers(hostHandlers, definition.name)
    handlers.set(definition.name, hostHandlers)
  }
  try {
    for (const definition of builtins) install(definition)
  } catch (error) {
    closed = true
    for (const name of activeHosts.keys()) revokeHost(name)
    const cleanup = await closeInstances()
    const errors = cleanup
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length > 0)
      throw new AggregateError([error, ...errors], 'Plugin creation and cleanup failed.')
    throw error
  }
  installedInstances = instances
  let disposal: Promise<void> | undefined
  const startReplacement = async (definition: InstalledComponentDefinition) => {
    const key = `${definition.name}@${definition.revision}`
    revisions.set(definition.name, definition.revision)
    definitionsByName.set(definition.name, definition)
    const retirement = retirementFailures.get(definition.name)
    if (retirement) {
      failures.set(key, retirement.error)
      return
    }
    if (failures.has(key)) return
    try {
      install(definition)
    } catch (error) {
      let failure = error
      const partial = instances.get(definition.name)
      instances.delete(definition.name)
      handlers.delete(definition.name)
      revokeHost(definition.name)
      try {
        if (typeof partial?.dispose === 'function') await partial.dispose()
      } catch (cleanup) {
        const cleanupFailure = new AggregateError(
          [error, cleanup],
          `Component startup failed: ${String(error)}. Cleanup failed: ${String(cleanup)}.`,
        )
        failure = cleanupFailure
        retirementFailures.set(definition.name, {
          definition,
          error: `${cleanupFailure.message} Activation is blocked until the host is replaced.`,
        })
      }
      failures.set(key, failure instanceof Error ? failure.message : String(failure))
    }
  }
  const retire = async (name: string) => {
    const instance = instances.get(name)
    const definition = definitionsByName.get(name)
    instances.delete(name)
    handlers.delete(name)
    revisions.delete(name)
    definitionsByName.delete(name)
    revokeHost(name)
    if (definition) failures.delete(`${name}@${definition.revision}`)
    try {
      await instance?.dispose()
    } catch (error) {
      if (!definition) throw error
      retirementFailures.set(name, {
        definition,
        error: `Component retirement failed; activation is blocked until the host is replaced: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
  const replace = async (changed: InstalledComponentDefinition[], removed: string[]) => {
    await Promise.all([...removed, ...changed.map((definition) => definition.name)].map(retire))
    await Promise.all(changed.map(startReplacement))
    installedInstances = instances
    serviceGeneration += 1
    for (const listener of outputListeners) listener()
  }
  return {
    async reconcile(definitions: InstalledComponentDefinition[]) {
      if (closed) throw new Error('Plugin services are closed.')
      const desired = new Map(builtins.map((definition) => [definition.name, definition]))
      const rejected = new Map<string, string>()
      for (const definition of definitions) {
        if (Object.hasOwn(adapters, definition.name))
          rejected.set(
            definition.id,
            'This bundled component uses a shell-owned adapter. Replace it through the supported shell update, not a profile override.',
          )
        else desired.set(definition.name, definition)
      }
      const changed = [...desired.values()].filter(
        (definition) => revisions.get(definition.name) !== definition.revision,
      )
      const removed = [...revisions.keys()].filter((name) => !desired.has(name))
      const errors = new Map(rejected)
      const collectErrors = () => {
        for (const [name, retirement] of retirementFailures) {
          const definition = desired.get(name) ?? retirement.definition
          errors.set(retirement.definition.id, retirement.error)
          errors.set(definition.id, retirement.error)
        }
        for (const definition of definitions) {
          const error = failures.get(`${definition.name}@${definition.revision}`)
          if (error) errors.set(definition.id, error)
        }
      }
      if (changed.length === 0 && removed.length === 0) {
        collectErrors()
        return { pending: false, errors }
      }
      if (inFlight > 0) return { pending: true, errors }
      const applied = await transition(() => replace(changed, removed))
      collectErrors()
      return { pending: !applied, errors }
    },
    service: {
      async hostRequest(name: string, method: string, payload: unknown) {
        if (closed) throw new Error('Plugin services are closed.')
        const hostRequests = handlers.get(name)
        if (!hostRequests) throw new Error(`Plugin host is not ready: ${name}`)
        return track(() => invokePluginRequest(hostRequests, method, payload))
      },
      async request(name: string, method: string, payload: unknown) {
        if (closed) throw new Error('Plugin services are closed.')
        const instance = instances.get(name)
        if (!instance) throw new Error(`Plugin service is not installed: ${name}`)
        return track(() => invokePluginRequest(instance.requests, method, payload))
      },
    },
    dispose() {
      closed = true
      for (const name of activeHosts.keys()) revokeHost(name)
      outputListeners.clear()
      installedInstances = new Map()
      disposal ??= (async () => {
        await Promise.allSettled(requests)
        const results = await closeInstances()
        const errors = results
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason)
        if (errors.length > 0)
          throw new AggregateError(errors, 'Failed to dispose plugin services.')
      })()
      return disposal
    },
  }
}

function validateHostHandlers(handlers: object, name: string) {
  if (
    !handlers ||
    typeof handlers !== 'object' ||
    Object.values(handlers).some((handler) => typeof handler !== 'function')
  )
    throw new Error(`Invalid component host request handlers: ${name}`)
}
