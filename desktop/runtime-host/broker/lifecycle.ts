import * as Deferred from 'effect/Deferred'
import type * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as FiberSet from 'effect/FiberSet'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import { makeHostIdleController } from './idle.ts'
import { makeHostStartup } from './lifecycle-startup.ts'
import { hostProcess } from './lifecycle-state.ts'
import { forgetHost, resetBrokerHosts, updateHost } from './state.ts'
import {
  type BrokerState,
  brokerError,
  type HostMessageHandler,
  type PendingRequest,
  type RuntimeHostBrokerError,
  type RuntimeHostProcessAdapter,
} from './types.ts'

export { hostProcess } from './lifecycle-state.ts'
export type { HostMessageHandler } from './types.ts'

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
        if (!host || host.lifecycle.status === 'Stopped' || host.lifecycle.status === 'Stopping')
          return [null, current] as const
        if (requireIdle && (host.role !== 'thread' || host.pendingRequests.size > 0 || host.busy))
          return [null, current] as const
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
    const ensureHost = makeHostStartup({
      adapter,
      idle,
      rejectPending,
      rootScope,
      runCallback,
      state,
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
        (host) =>
          host.lifecycle.status === 'Stopped'
            ? Effect.void
            : Scope.close(host.lifecycle.scope, Exit.void),
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
      runningHostIds: Effect.map(Ref.get(state), (current) => {
        const runningHostIds: string[] = []
        for (const host of current.hosts.values()) {
          if (host.lifecycle.status === 'Starting' || host.lifecycle.status === 'Running')
            runningHostIds.push(host.id)
        }
        return runningHostIds
      }),
      scheduleIdle: idle.schedule,
      stopAll,
      suspendIdle: idle.remove,
    }
  })
}
