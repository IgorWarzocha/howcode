import type { PluginServiceInstance } from '@howaboua/howcode-sdk/plugins'

type Runtime = Parameters<NonNullable<PluginServiceInstance['bindRuntime']>>[0]
let current: Runtime | undefined
let pending: Promise<void> = Promise.resolve()
const cleanups = new Map<PluginServiceInstance, () => Promise<void> | void>()

/** Host identity ports can read the acquired native runtime while features bind,
 * without recursively awaiting the readiness promise that their bind holds. */
export function boundPluginRuntime() {
  return current
}

function serialize(operation: () => Promise<void>) {
  const result = pending.then(operation)
  // The caller receives rejection; subsequent lifecycle operations must still drain.
  pending = result.catch(() => undefined)
  return result
}

async function bind(instance: PluginServiceInstance, runtime: Runtime) {
  if (instance.bindRuntime && !cleanups.has(instance))
    cleanups.set(instance, await instance.bindRuntime(runtime))
}

export function bindPluginInstance(instance: PluginServiceInstance) {
  return serialize(async () => {
    if (current) await bind(instance, current)
  })
}

export function unbindPluginInstance(instance: PluginServiceInstance) {
  return serialize(async () => {
    const cleanup = cleanups.get(instance)
    if (!cleanup) return
    await cleanup()
    cleanups.delete(instance)
  })
}

export function bindPluginRuntime(runtime: Runtime, instances: readonly PluginServiceInstance[]) {
  return serialize(async () => {
    if (current || cleanups.size > 0)
      throw new Error('Plugin services are still bound to a runtime.')
    current = runtime
    try {
      const bindings = await Promise.allSettled(
        instances.map((instance) => bind(instance, runtime)),
      )
      const errors = bindings
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason)
      if (errors.length > 0) throw new AggregateError(errors, 'Component runtime binding failed.')
    } catch (error) {
      const results = await Promise.allSettled(
        [...cleanups].map(async ([instance, cleanup]) => {
          await cleanup()
          cleanups.delete(instance)
        }),
      )
      current = undefined
      throw new AggregateError(
        [
          error,
          ...results
            .filter((result) => result.status === 'rejected')
            .map((result) => result.reason),
        ],
        'Plugin runtime binding failed.',
      )
    }
  })
}

export function unbindPluginRuntime(harness: Runtime['harness']) {
  return serialize(async () => {
    if (current?.harness !== harness) return
    current = undefined
    const results = await Promise.allSettled(
      [...cleanups].map(async ([instance, cleanup]) => {
        await cleanup()
        cleanups.delete(instance)
      }),
    )
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length > 0) throw new AggregateError(errors, 'Plugin runtime cleanup failed.')
  })
}
