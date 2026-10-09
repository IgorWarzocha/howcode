import {
  invokePluginRequest,
  type PluginServiceContribution,
  type PluginServiceHost,
  type PluginServiceInstance,
} from '@howaboua/howcode-sdk/plugins'
import { installedServiceContributions } from './installed-services.generated.ts'

let installedInstances: ReadonlyMap<string, PluginServiceInstance> = new Map()
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
) {
  const instances = new Map<string, PluginServiceInstance>()
  const closeInstances = () =>
    Promise.allSettled(
      [...instances.values()].map((instance) => Promise.resolve().then(() => instance.dispose())),
    )
  try {
    for (const [name, contribution] of Object.entries(installedServiceContributions)) {
      const pluginHost = {
        ...(host.agent ? { agent: host.agent } : {}),
        publishEvent: (event: unknown) =>
          host.publishEvent({ type: 'plugin-event', plugin: name, event }),
      }
      instances.set(
        name,
        adapters[name]?.(contribution, pluginHost) ?? contribution.create(pluginHost),
      )
    }
  } catch (error) {
    const cleanup = await closeInstances()
    const errors = cleanup
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length > 0)
      throw new AggregateError([error, ...errors], 'Plugin creation and cleanup failed.')
    throw error
  }
  let closed = false
  installedInstances = instances
  let disposal: Promise<void> | undefined
  return {
    service: {
      async request(name: string, method: string, payload: unknown) {
        if (closed) throw new Error('Plugin services are closed.')
        const instance = instances.get(name)
        if (!instance) throw new Error(`Plugin service is not installed: ${name}`)
        return invokePluginRequest(instance.requests, method, payload)
      },
    },
    dispose() {
      closed = true
      installedInstances = new Map()
      disposal ??= (async () => {
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
