import * as Deferred from 'effect/Deferred'
import type * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Option from 'effect/Option'
import * as Scope from 'effect/Scope'
import { makeRuntimeIdleScheduler } from './live-runtime-idle.ts'
import { makeRuntimeRegistryState, type RuntimeRecord } from './live-runtime-registry-state.ts'
import type {
  ExistingRuntimeInput,
  NewRuntimeInput,
  RuntimeRegistry,
  RuntimeRegistryAdapters,
  RuntimeRegistryError,
} from './live-runtime-registry-types.ts'

export type {
  ExistingRuntimeInput,
  NewRuntimeInput,
  RuntimeRegistry,
  RuntimeRegistryAdapters,
} from './live-runtime-registry-types.ts'
export { RuntimeRegistryError } from './live-runtime-registry-types.ts'

export const makeRuntimeRegistry = <Runtime>(
  adapters: RuntimeRegistryAdapters<Runtime>,
  options: { readonly idleTimeout: Duration.Input },
): Effect.Effect<RuntimeRegistry<Runtime>, never, Scope.Scope> =>
  Effect.gen(function* () {
    const parentScope = yield* Scope.Scope
    const state = yield* makeRuntimeRegistryState<Runtime>()

    const closeRecord = Effect.fn('RuntimeRegistry.closeRecord')(function* (
      record: RuntimeRecord<Runtime>,
    ) {
      yield* Scope.close(record.scope, Exit.void)
    })

    const idle = yield* makeRuntimeIdleScheduler({
      adapters,
      closeRecord,
      idleTimeout: options.idleTimeout,
      state,
    })

    const detachAndClose = Effect.fn('RuntimeRegistry.detachAndClose')(function* (
      runtimeKey: string,
      record: RuntimeRecord<Runtime>,
    ) {
      yield* idle.suspend(runtimeKey)
      yield* state.remove(runtimeKey, record.id)
      yield* closeRecord(record)
    })

    const reserveRecord = Effect.fn('RuntimeRegistry.reserveRecord')(function* (
      runtimeKey: string,
      settingsCwd: string | null,
    ) {
      const runtime = yield* Deferred.make<Runtime, RuntimeRegistryError>()
      return yield* state.reserve(runtimeKey, {
        runtime,
        scope: Scope.forkUnsafe(parentScope),
        settingsCwd,
        staleGeneration: null,
      })
    })

    const completeReservation = Effect.fn('RuntimeRegistry.completeReservation')(function* (
      runtimeKey: string,
      record: RuntimeRecord<Runtime>,
      acquire: Effect.Effect<Runtime, RuntimeRegistryError>,
    ) {
      return yield* acquire.pipe(
        Effect.tap((runtime) => Scope.addFinalizer(record.scope, adapters.release(runtime))),
        Effect.onExit((exit) =>
          Deferred.done(record.runtime, exit).pipe(
            Effect.andThen(Exit.isFailure(exit) ? detachAndClose(runtimeKey, record) : Effect.void),
          ),
        ),
      )
    })

    const getCached = Effect.fn('RuntimeRegistry.getCached')(function* (runtimeKey: string) {
      const record = yield* state.get(runtimeKey)
      return record ? yield* Deferred.await(record.runtime) : null
    })

    const getOrCreate = Effect.fn('RuntimeRegistry.getOrCreate')(function* (
      input: ExistingRuntimeInput & { readonly suspendDisposal: boolean },
    ) {
      if (input.suspendDisposal) yield* idle.suspend(input.runtimeKey)
      return yield* state.withLifecycleLock(
        input.runtimeKey,
        Effect.gen(function* () {
          const existing = yield* state.get(input.runtimeKey)
          if (existing?.settingsCwd === input.settingsCwd) {
            return yield* Deferred.await(existing.runtime)
          }
          if (existing) yield* detachAndClose(input.runtimeKey, existing)

          const record = yield* reserveRecord(input.runtimeKey, input.settingsCwd)
          return yield* completeReservation(
            input.runtimeKey,
            record,
            adapters.createExisting(input),
          )
        }),
      )
    })

    const createNew = Effect.fn('RuntimeRegistry.createNew')(function* (input: NewRuntimeInput) {
      const runtime = yield* adapters.createNew(input)
      adapters.setBranchName(runtime, input.branchName)
      const runtimeKey = adapters.runtimeKey(runtime)
      if (!runtimeKey) return runtime

      yield* state.withLifecycleLock(
        runtimeKey,
        Effect.gen(function* () {
          const existing = yield* state.get(runtimeKey)
          if (existing) yield* detachAndClose(runtimeKey, existing)
          const record = yield* reserveRecord(runtimeKey, input.sessionDir)
          yield* Scope.addFinalizer(record.scope, adapters.release(runtime))
          yield* Deferred.succeed(record.runtime, runtime)
        }),
      )
      return runtime
    })

    const reloadUnlocked = Effect.fn('RuntimeRegistry.reloadUnlocked')(function* (
      runtimeKey: string,
    ) {
      return yield* state.withLifecycleLock(
        runtimeKey,
        Effect.gen(function* () {
          const record = yield* state.get(runtimeKey)
          if (!record || record.staleGeneration === null) return false
          const staleGeneration = record.staleGeneration
          const runtime = yield* Deferred.await(record.runtime)
          if (adapters.isWorking(runtime)) return false
          const reloaded = yield* Effect.match(adapters.reload(runtime), {
            onFailure: () => false,
            onSuccess: () => true,
          })
          if (!reloaded) return false
          yield* state.clearStale(runtimeKey, record.id, staleGeneration)
          return true
        }),
      )
    })

    const reloadIfSafe = Effect.fn('RuntimeRegistry.reloadIfSafe')(function* (
      runtimeKey: string,
      useMutationLock: boolean,
    ) {
      return useMutationLock
        ? yield* state.withMutationLock(runtimeKey, reloadUnlocked(runtimeKey))
        : yield* reloadUnlocked(runtimeKey)
    })

    const markStale = Effect.fn('RuntimeRegistry.markStale')(function* (
      runtimeKey: string,
      expectedRecordId?: number,
    ) {
      yield* idle.suspend(runtimeKey)
      const record = yield* state.markStale(runtimeKey, expectedRecordId)
      if (!record) return
      const loaded = yield* Effect.match(Deferred.await(record.runtime), {
        onFailure: () => false,
        onSuccess: () => true,
      })
      if (!loaded) {
        yield* detachAndClose(runtimeKey, record)
        return
      }
      yield* reloadIfSafe(runtimeKey, true)
    })

    const invalidate = Effect.fn('RuntimeRegistry.invalidate')(function* (input: {
      readonly runtimeKey: string | null
      readonly projectPath: string | null
    }) {
      if (input.runtimeKey) {
        yield* markStale(input.runtimeKey)
        return
      }

      yield* Effect.forEach(
        yield* state.entries,
        ([runtimeKey, record]) =>
          Effect.gen(function* () {
            const runtime = yield* Effect.option(Deferred.await(record.runtime))
            if (Option.isNone(runtime)) {
              yield* detachAndClose(runtimeKey, record)
              return
            }
            if (input.projectPath && adapters.runtimeCwd(runtime.value) !== input.projectPath)
              return
            yield* markStale(runtimeKey, record.id)
          }),
        { concurrency: 'unbounded', discard: true },
      )
    })

    const disposeRecord = Effect.fn('RuntimeRegistry.disposeRecord')(function* (
      runtimeKey: string,
      record: RuntimeRecord<Runtime>,
      abort: boolean,
    ) {
      yield* idle.suspend(runtimeKey)
      const runtime = yield* Effect.option(Deferred.await(record.runtime))
      if (!(yield* state.remove(runtimeKey, record.id))) return
      if (abort && Option.isSome(runtime)) yield* adapters.abort(runtime.value)
      yield* closeRecord(record)
    })

    const dispose = Effect.fn('RuntimeRegistry.dispose')(function* (input: {
      readonly projectPath: string | null
      readonly runtimeKeys: ReadonlySet<string>
    }) {
      yield* Effect.forEach(
        yield* state.entries,
        ([runtimeKey, record]) =>
          state.withLifecycleLock(
            runtimeKey,
            Effect.gen(function* () {
              const runtime = yield* Effect.option(Deferred.await(record.runtime))
              if (Option.isNone(runtime)) {
                yield* detachAndClose(runtimeKey, record)
                return
              }
              const selected =
                input.runtimeKeys.has(runtimeKey) ||
                Boolean(
                  input.projectPath && adapters.runtimeCwd(runtime.value) === input.projectPath,
                )
              if (selected) yield* disposeRecord(runtimeKey, record, true)
            }),
          ),
        { concurrency: 'unbounded', discard: true },
      )
    })

    const disposeAll = Effect.fn('RuntimeRegistry.disposeAll')(function* () {
      yield* idle.clear
      yield* Effect.forEach(
        yield* state.entries,
        ([runtimeKey, record]) =>
          state.withLifecycleLock(runtimeKey, disposeRecord(runtimeKey, record, false)),
        { concurrency: 'unbounded', discard: true },
      )
    })

    const registry: RuntimeRegistry<Runtime> = {
      getCached,
      getOrCreate,
      createNew,
      withMutationLock: state.withMutationLock,
      reloadIfSafe,
      invalidate,
      scheduleDisposal: idle.schedule,
      suspendDisposal: idle.suspend,
      dispose,
      disposeAll: disposeAll(),
    }

    yield* Scope.addFinalizer(parentScope, registry.disposeAll)
    return registry
  })
