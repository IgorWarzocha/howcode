import type * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as RcMap from 'effect/RcMap'
import * as Ref from 'effect/Ref'
import type * as Scope from 'effect/Scope'
import * as Semaphore from 'effect/Semaphore'
import type { RuntimeRegistryError } from './live-runtime-registry-types.ts'

export type RuntimeRecord<Runtime> = {
  readonly id: number
  readonly runtime: Deferred.Deferred<Runtime, RuntimeRegistryError>
  readonly scope: Scope.Closeable
  readonly settingsCwd: string | null
  readonly staleGeneration: number | null
}

type RegistryState<Runtime> = {
  readonly records: ReadonlyMap<string, RuntimeRecord<Runtime>>
  readonly nextRecordId: number
}

export interface RuntimeRegistryState<Runtime> {
  readonly entries: Effect.Effect<readonly (readonly [string, RuntimeRecord<Runtime>])[]>
  readonly get: (runtimeKey: string) => Effect.Effect<RuntimeRecord<Runtime> | null>
  readonly reserve: (
    runtimeKey: string,
    input: Omit<RuntimeRecord<Runtime>, 'id'>,
  ) => Effect.Effect<RuntimeRecord<Runtime>>
  readonly remove: (runtimeKey: string, recordId: number) => Effect.Effect<boolean>
  readonly markStale: (
    runtimeKey: string,
    expectedRecordId?: number,
  ) => Effect.Effect<RuntimeRecord<Runtime> | null>
  readonly clearStale: (
    runtimeKey: string,
    recordId: number,
    staleGeneration: number,
  ) => Effect.Effect<void>
  readonly withLifecycleLock: <A, E, R>(
    runtimeKey: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>
  readonly withMutationLock: <A, E, R>(
    runtimeKey: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>
}

function updateMap<K, V>(map: ReadonlyMap<K, V>, update: (copy: Map<K, V>) => void) {
  const copy = new Map(map)
  update(copy)
  return copy
}

export const makeRuntimeRegistryState = <Runtime>(): Effect.Effect<
  RuntimeRegistryState<Runtime>,
  never,
  Scope.Scope
> =>
  Effect.gen(function* () {
    const state = yield* Ref.make<RegistryState<Runtime>>({
      records: new Map(),
      nextRecordId: 1,
    })

    const lifecycleLocks = yield* RcMap.make({ lookup: (_key: string) => Semaphore.make(1) })
    const mutationLocks = yield* RcMap.make({ lookup: (_key: string) => Semaphore.make(1) })

    const withKeyLock = <A, E, R>(
      locks: RcMap.RcMap<string, Semaphore.Semaphore>,
      runtimeKey: string,
      effect: Effect.Effect<A, E, R>,
    ) =>
      Effect.scoped(
        RcMap.get(locks, runtimeKey).pipe(
          Effect.flatMap((semaphore) => semaphore.withPermit(effect)),
        ),
      )

    const get = (runtimeKey: string) =>
      Effect.map(Ref.get(state), (current) => current.records.get(runtimeKey) ?? null)

    const reserve = Effect.fn('RuntimeRegistryState.reserve')(function* (
      runtimeKey: string,
      input: Omit<RuntimeRecord<Runtime>, 'id'>,
    ) {
      return yield* Ref.modify(state, (current) => {
        const record: RuntimeRecord<Runtime> = { id: current.nextRecordId, ...input }
        return [
          record,
          {
            ...current,
            nextRecordId: current.nextRecordId + 1,
            records: updateMap(current.records, (records) => records.set(runtimeKey, record)),
          },
        ] as const
      })
    })

    const remove = Effect.fn('RuntimeRegistryState.remove')(function* (
      runtimeKey: string,
      recordId: number,
    ) {
      return yield* Ref.modify(state, (current) => {
        const record = current.records.get(runtimeKey)
        if (!record || record.id !== recordId) return [false, current] as const
        return [
          true,
          {
            ...current,
            records: updateMap(current.records, (records) => records.delete(runtimeKey)),
          },
        ] as const
      })
    })

    const markStale = Effect.fn('RuntimeRegistryState.markStale')(function* (
      runtimeKey: string,
      expectedRecordId?: number,
    ) {
      return yield* Ref.modify(state, (current) => {
        const existing = current.records.get(runtimeKey)
        if (!existing || (expectedRecordId !== undefined && existing.id !== expectedRecordId)) {
          return [null, current] as const
        }
        const staleRecord = {
          ...existing,
          staleGeneration: (existing.staleGeneration ?? 0) + 1,
        }
        return [
          staleRecord,
          {
            ...current,
            records: updateMap(current.records, (records) => records.set(runtimeKey, staleRecord)),
          },
        ] as const
      })
    })

    const clearStale = Effect.fn('RuntimeRegistryState.clearStale')(function* (
      runtimeKey: string,
      recordId: number,
      staleGeneration: number,
    ) {
      yield* Ref.update(state, (current) => {
        const record = current.records.get(runtimeKey)
        if (!record || record.id !== recordId || record.staleGeneration !== staleGeneration)
          return current
        return {
          ...current,
          records: updateMap(current.records, (records) =>
            records.set(runtimeKey, { ...record, staleGeneration: null }),
          ),
        }
      })
    })

    return {
      entries: Effect.map(Ref.get(state), (current) => [...current.records.entries()]),
      get,
      reserve,
      remove,
      markStale,
      clearStale,
      withLifecycleLock: (runtimeKey, effect) => withKeyLock(lifecycleLocks, runtimeKey, effect),
      withMutationLock: (runtimeKey, effect) => withKeyLock(mutationLocks, runtimeKey, effect),
    }
  })
