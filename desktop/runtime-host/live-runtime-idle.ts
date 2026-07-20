import * as Deferred from 'effect/Deferred'
import type * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as FiberMap from 'effect/FiberMap'
import * as Option from 'effect/Option'
import * as Schedule from 'effect/Schedule'
import type * as Scope from 'effect/Scope'
import type { RuntimeRecord, RuntimeRegistryState } from './live-runtime-registry-state.ts'
import type { RuntimeRegistryAdapters } from './live-runtime-registry-types.ts'

export interface RuntimeIdleScheduler {
  readonly clear: Effect.Effect<void>
  readonly schedule: (runtimeKey: string) => Effect.Effect<void>
  readonly suspend: (runtimeKey: string) => Effect.Effect<void>
}

function idleDisposition<Runtime>(
  adapters: RuntimeRegistryAdapters<Runtime>,
  runtime: Runtime,
): 'dispose' | 'retry' | 'stop' {
  if (adapters.hasPendingDialog(runtime)) return 'stop'
  return adapters.isWorking(runtime) ? 'retry' : 'dispose'
}

export const makeRuntimeIdleScheduler = <Runtime>(input: {
  readonly adapters: RuntimeRegistryAdapters<Runtime>
  readonly closeRecord: (record: RuntimeRecord<Runtime>) => Effect.Effect<void>
  readonly idleTimeout: Duration.Input
  readonly state: RuntimeRegistryState<Runtime>
}): Effect.Effect<RuntimeIdleScheduler, never, Scope.Scope> =>
  Effect.gen(function* () {
    const fibers = yield* FiberMap.make<string>()

    const inspect = Effect.fn('RuntimeIdleScheduler.inspect')(function* (
      runtimeKey: string,
      recordId: number,
    ) {
      const record = yield* input.state.get(runtimeKey)
      if (!record || record.id !== recordId) return false
      const runtime = yield* Effect.option(Deferred.await(record.runtime))
      if (Option.isNone(runtime)) {
        yield* input.state.remove(runtimeKey, record.id)
        yield* input.closeRecord(record)
        return false
      }
      const disposition = idleDisposition(input.adapters, runtime.value)
      if (disposition === 'dispose' && (yield* input.state.remove(runtimeKey, record.id))) {
        yield* input.closeRecord(record)
      }
      return disposition === 'retry'
    })

    const schedule = Effect.fn('RuntimeIdleScheduler.schedule')(function* (runtimeKey: string) {
      yield* input.state.withLifecycleLock(
        runtimeKey,
        Effect.gen(function* () {
          const record = yield* input.state.get(runtimeKey)
          if (!record) return
          const worker = input.state
            .withLifecycleLock(runtimeKey, inspect(runtimeKey, record.id))
            .pipe(
              Effect.repeat({
                schedule: Schedule.spaced(input.idleTimeout),
                while: (retry) => retry,
              }),
              Effect.delay(input.idleTimeout),
              Effect.asVoid,
            )
          yield* FiberMap.run(fibers, runtimeKey, worker, { startImmediately: true })
        }),
      )
    })

    const suspend = Effect.fn('RuntimeIdleScheduler.suspend')(function* (runtimeKey: string) {
      yield* FiberMap.remove(fibers, runtimeKey)
    })

    return { clear: FiberMap.clear(fibers), schedule, suspend }
  })
