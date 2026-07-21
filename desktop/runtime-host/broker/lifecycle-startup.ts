import * as Cause from 'effect/Cause'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import { hostProcess, reserveHostStart } from './lifecycle-state.ts'
import { forgetHost, updateHost } from './state.ts'
import {
  type BrokerState,
  brokerError,
  type HostMessageHandler,
  type PendingRequest,
  type RuntimeHostBrokerError,
  type RuntimeHostProcessAdapter,
} from './types.ts'

type RunCallback = (effect: Effect.Effect<unknown, never>) => void

export function makeHostStartup<Process>(options: {
  readonly adapter: RuntimeHostProcessAdapter<Process>
  readonly idle: { readonly remove: (hostId: string) => Effect.Effect<void> }
  readonly rejectPending: (
    pending: Iterable<PendingRequest>,
    error: RuntimeHostBrokerError,
  ) => Effect.Effect<void>
  readonly rootScope: Scope.Scope
  readonly runCallback: RunCallback
  readonly state: Ref.Ref<BrokerState<Process>>
}) {
  const { adapter, idle, rejectPending, rootScope, runCallback, state } = options

  const handleExit = Effect.fn('RuntimeHostBroker.handleExit')(function* (
    hostId: string,
    process: Process,
    code: number | null,
    signal: NodeJS.Signals | null,
  ) {
    const exited = yield* Ref.modify(state, (current) => {
      const host = current.hosts.get(hostId)
      if (!host || host.lifecycle.status === 'Stopped' || hostProcess(host) !== process)
        return [null, current] as const
      return [
        { host, pending: [...host.pendingRequests.values()], scope: host.lifecycle.scope },
        forgetHost(current, hostId),
      ] as const
    })
    if (!exited) return
    yield* idle.remove(hostId)
    yield* rejectPending(
      exited.pending,
      brokerError(
        'exit',
        new Error(
          `Pi runtime host ${exited.host.label} exited${code === null ? '' : ` with code ${code}`}${signal ? ` (${signal})` : ''}.`,
        ),
      ),
    )
    yield* Scope.close(exited.scope, Exit.void)
  })

  const startHost = Effect.fn('RuntimeHostBroker.startHost')(function* (
    hostId: string,
    scope: Scope.Closeable,
    ready: Deferred.Deferred<Process, RuntimeHostBrokerError>,
    handleMessage: HostMessageHandler<Process>,
  ) {
    const host = (yield* Ref.get(state)).hosts.get(hostId)
    if (!host) return yield* Effect.fail(brokerError('start', new Error('Host vanished.')))

    const spawned = yield* Effect.acquireRelease(
      adapter.spawn(host.label, {
        onExit: (process, code, signal) => {
          runCallback(handleExit(hostId, process, code, signal))
        },
        onMessage: (process, message) => {
          runCallback(
            handleMessage(hostId, process, message).pipe(
              Effect.catch((error) =>
                Effect.sync(() => console.error('Pi runtime host message failed.', error)),
              ),
            ),
          )
        },
      }),
      (handle) => adapter.terminate(handle.process),
    ).pipe(Scope.provide(scope))

    const attached = yield* Ref.modify(state, (current) => {
      const currentHost = current.hosts.get(hostId)
      if (currentHost?.lifecycle.status !== 'Starting' || currentHost.lifecycle.scope !== scope) {
        return [false, current] as const
      }
      return [
        true,
        updateHost(current, hostId, (record) => ({
          ...record,
          lifecycle: { ...currentHost.lifecycle, process: spawned.process },
        })),
      ] as const
    })
    if (!attached) return yield* Effect.fail(brokerError('start', new Error('Host was stopped.')))

    yield* spawned.ready
    const running = yield* Ref.modify(state, (current) => {
      const currentHost = current.hosts.get(hostId)
      if (currentHost?.lifecycle.status !== 'Starting' || currentHost.lifecycle.scope !== scope) {
        return [false, current] as const
      }
      return [
        true,
        updateHost(current, hostId, (record) => ({
          ...record,
          lifecycle: { status: 'Running', process: spawned.process, scope },
        })),
      ] as const
    })
    if (running) yield* Deferred.succeed(ready, spawned.process)
    else return yield* Effect.fail(brokerError('start', new Error('Host was stopped.')))
  })

  return Effect.fn('RuntimeHostBroker.ensureHost')(function* (
    hostId: string,
    handleMessage: HostMessageHandler<Process>,
  ) {
    const ready = yield* Deferred.make<Process, RuntimeHostBrokerError>()
    const scope = yield* Scope.fork(rootScope)
    const decision = yield* Ref.modify(state, (current) =>
      reserveHostStart({ adapter, current, hostId, ready, scope }),
    )

    if (decision.status !== 'Start') yield* Scope.close(scope, Exit.void)
    if (decision.status === 'Ready') {
      yield* idle.remove(hostId)
      return decision.process
    }
    if (decision.status === 'Wait') return yield* Deferred.await(decision.ready)
    if (decision.status === 'Unavailable')
      return yield* Effect.fail(brokerError('ensureHost', new Error(decision.message)))
    if (decision.staleScope) yield* Scope.close(decision.staleScope, Exit.void)

    const startup = startHost(hostId, scope, ready, handleMessage).pipe(
      Effect.onExit((exit) => {
        if (Exit.isSuccess(exit)) return Effect.void
        const error = brokerError('start', Cause.squash(exit.cause))
        return Effect.gen(function* () {
          yield* Ref.update(state, (current) => {
            const host = current.hosts.get(hostId)
            return host?.lifecycle.status === 'Starting' && host.lifecycle.scope === scope
              ? forgetHost(current, hostId)
              : current
          })
          yield* Deferred.fail(ready, error)
          runCallback(Scope.close(scope, Exit.void))
        })
      }),
      Effect.catch(() => Effect.void),
    )
    yield* Effect.forkIn(startup, scope)
    return yield* Deferred.await(ready)
  })
}
