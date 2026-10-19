import {
  invokePluginRequest,
  type PluginConversation,
  type PluginServiceContribution,
  type PluginServiceHost,
  type PluginServiceInstance,
  type PluginWorkspaceAgent,
} from '@howaboua/howcode-sdk/plugins'
import type { InstalledComponentDefinition } from '../../components/packages/service/index.ts'
import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type {
  AnyDesktopActionPayload,
  DesktopActionResultData,
} from '../../shared/desktop-contracts.ts'
import { bindPluginInstance, bindPluginRuntime, unbindPluginInstance } from './runtime-bindings.ts'

export { unbindPluginRuntime } from './runtime-bindings.ts'
export function bindInstalledPluginRuntime(runtime: Parameters<typeof bindPluginRuntime>[0]) {
  return bindPluginRuntime(runtime, [...installedInstances.values()])
}

let installedInstances: ReadonlyMap<string, PluginServiceInstance> = new Map()
export function hasInstalledPluginService(name: string) {
  return installedInstances.has(name)
}
let serviceGeneration = 0
export function installedPluginGeneration() {
  return serviceGeneration
}
export function installedBusyComponents() {
  return [...installedInstances]
    .filter(([name, instance]) => {
      const busy = instance.isBusy?.() ?? false
      if (typeof busy !== 'boolean') throw new Error(`Invalid component busy state: ${name}`)
      return busy
    })
    .map(([name]) => name)
}
export function installedTerminalCapability() {
  const providers = [...installedInstances.values()].flatMap((instance) =>
    instance.terminal ? [instance.terminal] : [],
  )
  if (providers.length > 1) throw new Error('Conflicting component terminal providers.')
  return providers[0]
}
export function installedAgentTools() {
  return [...installedInstances].flatMap(([plugin, instance]) =>
    (instance.tools ?? []).map((tool) => ({ plugin, tool })),
  )
}
export function installedServiceExtensions() {
  return [...installedInstances.values()].flatMap((instance) => instance.extensions ?? [])
}
export function installedSkillResources(selectedExtensionNames: readonly string[] = []) {
  const selected = new Set(selectedExtensionNames)
  return [...installedInstances.values()].flatMap((instance) =>
    (instance.skills ?? []).filter((skill) => selected.has(skill.extensionName)),
  )
}
async function resolveCapability<T>(
  resolve: (instance: PluginServiceInstance) => Promise<T | undefined> | undefined,
  label: string,
) {
  const results = (await Promise.all([...installedInstances.values()].map(resolve))).filter(
    (result) => result !== undefined,
  )
  if (results.length > 1) throw new Error(`Conflicting component ${label} providers.`)
  return results[0]
}
export function resolveInstalledWorkspaceAgent(
  workspaceId: string,
): Promise<PluginWorkspaceAgent | undefined> {
  return resolveCapability((instance) => instance.workspaceAgent?.(workspaceId), 'workspace agent')
}
export function resolveInstalledConversationAssociation(
  id: string,
): Promise<PluginConversation | undefined> {
  return resolveCapability(
    (instance) => instance.conversationAssociation?.(id),
    'conversation association',
  )
}
export async function admitPluginInput(conversationId: string) {
  const results = await Promise.allSettled(
    [...installedInstances.values()].map((instance) => instance.beforeInput?.(conversationId)),
  )
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
}
export async function freezePluginTurn(conversationId: string) {
  await Promise.all(
    [...installedInstances.values()].map((instance) => instance.freezeTurn?.(conversationId)),
  )
}

export async function deletePluginConversations(ids: readonly string[]) {
  await Promise.all(
    [...installedInstances.values()].map((instance) => instance.deleteConversations?.(ids)),
  )
}

export async function createInstalledPluginServices(
  host: PluginServiceHost,
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
    const models = host.models
    const pluginHost = {
      ...host,
      ...(models
        ? {
            models: async () => {
              if (!active()) throw new Error('Component service host is retired.')
              const resolved = await models()
              if (!active()) throw new Error('Component service host is retired.')
              return resolved
            },
          }
        : {}),
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
      ? contribution.create(pluginHost)
      : {
          requests: {},
          dispose() {
            /* Renderer-only components have no native resources. */
          },
        }
  }
  const install = async (definition: InstalledComponentDefinition) => {
    const native = createInstance(definition.name, definition.service)
    if (!native || typeof native !== 'object' || typeof native.dispose !== 'function')
      throw new Error(`Invalid component service lifecycle: ${definition.name}`)
    const bindRuntime = native.bindRuntime?.bind(native)
    const instance: PluginServiceInstance = {
      requests: native.requests,
      dispose: async (reason) => {
        await unbindPluginInstance(instance)
        await native.dispose(reason)
      },
      extensions: native.extensions ?? [],
      beforeInput: async (id) => {
        await native.beforeInput?.(id)
      },
      ...(native.outputs ? { outputs: native.outputs } : {}),
      freezeTurn: async (id) => {
        await native.freezeTurn?.(id)
      },
    }
    if (bindRuntime) instance.bindRuntime = bindRuntime
    bindCapabilities(native, instance, track, () => {
      if (closed || instances.get(definition.name) !== instance)
        throw new Error('Component capability generation is retired.')
    })
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
    await activateRuntimeBinding(instance, definition.name)
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
      await install(definition)
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
      failures.set(
        key,
        `Component activation failed after retirement; the previous generation is no longer active: ${failure instanceof Error ? failure.message : String(failure)}`,
      )
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
      await instance?.dispose('retire')
    } catch (error) {
      if (!definition) throw error
      retirementFailures.set(name, {
        definition,
        error: `Component retirement failed; activation is blocked until the host is replaced: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
  const replace = async (changed: InstalledComponentDefinition[], removed: string[]) => {
    const previousTerminal = installedTerminalCapability()
    // Export preparation completed before this barrier. Creation/binding can
    // have effects, so retirement is irreversible: failed activation is not rollback.
    await Promise.all([...removed, ...changed.map((definition) => definition.name)].map(retire))
    await Promise.all(changed.map(startReplacement))
    installedInstances = instances
    serviceGeneration += 1
    if (previousTerminal !== installedTerminalCapability())
      host.publishEvent({
        type: 'terminal-runtime-changed',
        available: Boolean(installedTerminalCapability()),
      })
    for (const listener of outputListeners) listener()
  }
  return {
    async handleAction(action: DesktopAction, payload: AnyDesktopActionPayload) {
      for (const [name, instance] of instances) {
        if (!Object.hasOwn(instance.requests, 'handleAction')) continue
        const result = (await track(() =>
          invokePluginRequest(instance.requests, 'handleAction', { action, payload }),
        )) as { handled: boolean; result?: DesktopActionResultData | null }
        if (!result || typeof result.handled !== 'boolean')
          throw new Error(`Invalid component action result: ${name}`)
        if (result.handled) return result
      }
      return { handled: false as const }
    },
    async reconcile(definitions: InstalledComponentDefinition[]) {
      if (closed) throw new Error('Plugin services are closed.')
      const desired = new Map<string, InstalledComponentDefinition>()
      for (const definition of definitions) {
        desired.set(definition.name, definition)
      }
      const changed = [...desired.values()].filter(
        (definition) => revisions.get(definition.name) !== definition.revision,
      )
      const removed = [...revisions.keys()].filter((name) => !desired.has(name))
      const errors = new Map<string, string>()
      const active = () =>
        new Map(
          [...definitionsByName.values()]
            .filter((definition) => instances.has(definition.name))
            .map((definition) => [definition.id, definition.revision]),
        )
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
        return { pending: false, errors, active: active() }
      }
      if (inFlight > 0 || installedBusyComponents().length > 0)
        return { pending: true, errors, active: active() }
      const applied = await transition(() => replace(changed, removed))
      collectErrors()
      return { pending: !applied, errors, active: active() }
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

async function activateRuntimeBinding(instance: PluginServiceInstance, name: string) {
  try {
    await bindPluginInstance(instance)
  } catch (error) {
    throw new Error(`Component runtime binding failed: ${name}: ${String(error)}`, { cause: error })
  }
}

function bindCapabilities(
  native: PluginServiceInstance,
  instance: PluginServiceInstance,
  track: <T>(operation: () => Promise<T>) => Promise<T>,
  assertCurrent: () => void,
) {
  if (native.terminal) instance.terminal = native.terminal
  if (native.isBusy !== undefined) {
    if (typeof native.isBusy !== 'function') throw new Error('Invalid component busy callback.')
    instance.isBusy = native.isBusy.bind(native)
  }
  const leased = <T>(operation: () => Promise<T>) =>
    track(async () => {
      assertCurrent()
      const result = await operation()
      assertCurrent()
      return result
    })
  const workspaceAgent = native.workspaceAgent?.bind(native)
  const conversationAssociation = native.conversationAssociation?.bind(native)
  const deleteConversations = native.deleteConversations?.bind(native)
  if (workspaceAgent) instance.workspaceAgent = (id) => leased(() => workspaceAgent(id))
  if (conversationAssociation)
    instance.conversationAssociation = (id) => leased(() => conversationAssociation(id))
  if (deleteConversations)
    instance.deleteConversations = (ids) => leased(() => deleteConversations(ids))
  if (native.skills)
    instance.skills = Object.freeze(native.skills.map((skill) => Object.freeze({ ...skill })))
}

function validateHostHandlers(handlers: object, name: string) {
  if (
    !handlers ||
    typeof handlers !== 'object' ||
    Object.values(handlers).some((handler) => typeof handler !== 'function')
  )
    throw new Error(`Invalid component host request handlers: ${name}`)
}
