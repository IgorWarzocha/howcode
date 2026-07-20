import type * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as FiberMap from 'effect/FiberMap'
import * as Ref from 'effect/Ref'
import type { BrokerState, RuntimeHostBrokerError } from './types.ts'

export function makeHostIdleController<Process>(options: {
  readonly state: Ref.Ref<BrokerState<Process>>
  readonly timeout: Duration.Input
  readonly stopHostIfIdle: (hostId: string, error: RuntimeHostBrokerError) => Effect.Effect<void>
  readonly idleError: () => RuntimeHostBrokerError
}) {
  return Effect.gen(function* () {
    const fibers = yield* FiberMap.make<string>()

    const stopIfIdle = Effect.fn('RuntimeHostBroker.stopIfIdle')(function* (hostId: string) {
      const host = (yield* Ref.get(options.state)).hosts.get(hostId)
      if (
        host?.role !== 'thread' ||
        host.pendingRequests.size > 0 ||
        host.busy ||
        host.lifecycle.status === 'Stopping'
      ) {
        return
      }
      yield* options.stopHostIfIdle(hostId, options.idleError())
    })

    const schedule = Effect.fn('RuntimeHostBroker.scheduleIdle')(function* (hostId: string) {
      const host = (yield* Ref.get(options.state)).hosts.get(hostId)
      if (
        host?.role !== 'thread' ||
        host.pendingRequests.size > 0 ||
        host.busy ||
        host.lifecycle.status === 'Stopping'
      ) {
        return
      }
      yield* FiberMap.run(fibers, hostId, stopIfIdle(hostId).pipe(Effect.delay(options.timeout)), {
        startImmediately: true,
      })
    })

    return {
      clear: FiberMap.clear(fibers),
      remove: (hostId: string) => FiberMap.remove(fibers, hostId),
      schedule,
    }
  })
}
