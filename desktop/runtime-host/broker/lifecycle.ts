import * as Cause from 'effect/Cause'
import * as Deferred from 'effect/Deferred'
import type * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as FiberSet from 'effect/FiberSet'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import type { RuntimeHostToMainMessage } from '../protocol.ts'
import { makeHostIdleController } from './idle.ts'
import { forgetHost, resetBrokerHosts, updateHost } from './state.ts'
import {
  type BrokerState,
  brokerError,
  type HostRecord,
  type PendingRequest,
  type RuntimeHostBrokerError,
  type RuntimeHostProcessAdapter,
} from './types.ts'

type StartDecision<Process> =
  | { readonly status: 'Ready'; readonly process: Process }
  | { readonly status: 'Wait'; readonly ready: Deferred.Deferred<Process, RuntimeHostBrokerError> }
  | { readonly status: 'Start'; readonly staleScope: Scope.Closeable | null }
  | { readonly status: 'Unavailable'; readonly message: string }

export type HostMessageHandler<Process> = (
  hostId: string,
  process: Process,
  message: RuntimeHostToMainMessage,
) => Effect.Effect<void, RuntimeHostBrokerError>

export interface HostLifecycleService<Process> {
  readonly ensureHost: (
    hostId: string,
    handleMessage: HostMessageHandler<Process>,
  ) => Effect.Effect<Process, RuntimeHostBrokerError>
  readonly runningHostIds: Effect.Effect<readonly string[]>
  readonly scheduleIdle: (hostId: string) => Effect.Effect<void>
  readonly stopAll: (shuttingDown: boolean) => Effect.Effect<void>
  readonly suspendIdle: (hostId: string) => Effect.Effect<void>
}

export function hostProcess<Process>(host: HostRecord<Process>) {
  return host.lifecycle.status === 'Running' || host.lifecycle.status === 'Stopping'
    ? host.lifecycle.process
    : host.lifecycle.status === 'Starting'
      ? host.lifecycle.process
      : null
}

function reserveHostStart<Process>(options: {
  readonly adapter: RuntimeHostProcessAdapter<Process>
  readonly current: BrokerState<Process>
  readonly hostId: string
  readonly ready: Deferred.Deferred<Process, RuntimeHostBrokerError>
  readonly scope: Scope.Closeable
}): readonly [StartDecision<Process>, BrokerState<Process>] {
  const { adapter, current, hostId, ready, scope } = options
  const host = current.hosts.get(hostId)
  if (!host) return [{ status: 'Unavailable', message: 'Pi runtime host was removed.' }, current]
  if (current.shuttingDown)
    return [{ status: 'Unavailable', message: 'Pi runtime host is shutting down.' }, current]
  if (host.lifecycle.status === 'Starting')
    return [{ status: 'Wait', ready: host.lifecycle.ready }, current]
  if (host.lifecycle.status === 'Stopping')
    return [
      { status: 'Unavailable', message: `Pi runtime host ${host.label} is stopping.` },
      current,
    ]
  if (host.lifecycle.status === 'Running' && adapter.isRunning(host.lifecycle.process))
    return [{ status: 'Ready', process: host.lifecycle.process }, current]

  const staleScope = host.lifecycle.status === 'Running' ? host.lifecycle.scope : null
  return [
    { status: 'Start', staleScope },
    updateHost(current, hostId, (record) => ({
      ...record,
      lifecycle: { status: 'Starting', process: null, ready, scope },
    })),
  ]
}

export function makeHostLifecycle<Process>(options: {
  readonly adapter: RuntimeHostProcessAdapter<Process>
  readonly idleTimeout: Duration.Input
  readonly state: Ref.Ref<BrokerState<Process>>
}) {
  return Effect.gen(function* () {
    const { adapter, state } = options
    const rootScope = yield* Scope.Scope
    const runCallback = yield* FiberSet.makeRuntime<never, unknown, never>()

    const rejectPending = Effect.fn('RuntimeHostBroker.rejectPending')(function* (
      pending: Iterable<PendingRequest>,
      error: RuntimeHostBrokerError,
    ) {
      yield* Effect.forEach(pending, (request) => Deferred.fail(request.response, error), {
        discard: true,
      })
    })

    const stopHost = Effect.fn('RuntimeHostBroker.stopHost')(function* (
      hostId: string,
      error: RuntimeHostBrokerError,
      requireIdle: boolean,
    ) {
      const stopped = yield* Ref.modify(state, (current) => {
        const host = current.hosts.get(hostId)
        if (!host || host.lifecycle.status === 'Stopped') return [null, current] as const
        if (host.lifecycle.status === 'Stopping') return [null, current] as const
        if (requireIdle && (host.role !== 'thread' || host.pendingRequests.size > 0 || host.busy)) {
          return [null, current] as const
        }
        const scope = host.lifecycle.scope
        const process = hostProcess(host)
        return [
          { pending: [...host.pendingRequests.values()], scope },
          updateHost(current, hostId, (record) => ({
            ...record,
            lifecycle: { status: 'Stopping', process, scope },
            pendingRequests: new Map(),
            busy: false,
            lastSendComposerPromptAtMs: null,
          })),
        ] as const
      })
      if (!stopped) return
      yield* rejectPending(stopped.pending, error)
      yield* Scope.close(stopped.scope, Exit.void)
      yield* Ref.update(state, (current) => {
        const host = current.hosts.get(hostId)
        return host?.lifecycle.status === 'Stopping' && host.lifecycle.scope === stopped.scope
          ? forgetHost(current, hostId)
          : current
      })
    })

    const idle = yield* makeHostIdleController({
      state,
      timeout: options.idleTimeout,
      stopHostIfIdle: (hostId, error) => stopHost(hostId, error, true),
      idleError: () => brokerError('idle', new Error('Pi runtime host became idle.')),
    })

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
      if (!attached) {
        return yield* Effect.fail(brokerError('start', new Error('Host was stopped.')))
      }

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

    const ensureHost = Effect.fn('RuntimeHostBroker.ensureHost')(function* (
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
            yield* Effect.sync(() => runCallback(Scope.close(scope, Exit.void)))
          })
        }),
        Effect.catch(() => Effect.void),
      )
      yield* Effect.forkIn(startup, scope)
      return yield* Deferred.await(ready)
    })

    const stopAll = Effect.fn('RuntimeHostBroker.stopAll')(function* (shuttingDown: boolean) {
      const snapshot = yield* Ref.getAndUpdate(state, (current) =>
        resetBrokerHosts(current, shuttingDown),
      )
      yield* idle.clear
      yield* rejectPending(
        [...snapshot.hosts.values()].flatMap((host) => [...host.pendingRequests.values()]),
        shuttingDown
          ? brokerError('shutdown', new Error('Pi runtime host is shutting down.'))
          : brokerError('restart', new Error('Pi runtime host environment changed.')),
      )
      yield* Effect.forEach(
        snapshot.hosts.values(),
        (host) => {
          const lifecycle = host.lifecycle
          return lifecycle.status === 'Stopped'
            ? Effect.void
            : Scope.close(lifecycle.scope, Exit.void)
        },
        { discard: true, concurrency: 'unbounded' },
      )
    })

    const terminateAllNow = () => {
      const snapshot = Ref.getUnsafe(state)
      for (const host of snapshot.hosts.values()) {
        const process = hostProcess(host)
        if (process) adapter.terminateNow(process)
      }
    }
    yield* adapter.installShutdownHandlers(terminateAllNow)

    return {
      ensureHost,
      runningHostIds: Effect.map(Ref.get(state), (current) =>
        [...current.hosts.values()]
          .filter(
            (host) => host.lifecycle.status === 'Starting' || host.lifecycle.status === 'Running',
          )
          .map((host) => host.id),
      ),
      scheduleIdle: idle.schedule,
      stopAll,
      suspendIdle: idle.remove,
    }
  })
}
