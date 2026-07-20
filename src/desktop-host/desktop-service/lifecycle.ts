import * as Cause from 'effect/Cause'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as FiberSet from 'effect/FiberSet'
import * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import type { DesktopEvent } from '../../../shared/desktop-contracts'
import { detachCurrent, updateCurrent } from './state'
import {
  type DesktopServiceClientOptions,
  type DesktopServiceError,
  type DesktopServiceMessage,
  type DesktopServiceProcessAdapter,
  type DesktopServiceState,
  type PendingRequest,
  type ServiceRecord,
  serviceError,
  type TerminalRpcBridge,
} from './types'

type StartDecision<Process> =
  | { readonly status: 'Ready'; readonly process: Process }
  | { readonly status: 'Wait'; readonly ready: Deferred.Deferred<Process, DesktopServiceError> }
  | { readonly status: 'WaitClosed'; readonly closed: Deferred.Deferred<void> }
  | { readonly status: 'Start'; readonly stale: ServiceRecord<Process> | null }

export type ServiceMessageHandler<Process> = (
  process: Process,
  message: DesktopServiceMessage,
) => Effect.Effect<void, DesktopServiceError>

function diagnosticEvent(input: {
  severity: 'warning' | 'error'
  message: string
  details?: unknown
}): DesktopEvent {
  return {
    type: 'runtime-diagnostic',
    severity: input.severity,
    message: input.message,
    ...(input.details === undefined ? {} : { details: input.details }),
  }
}

function reserveStart<Process>(options: {
  readonly adapter: DesktopServiceProcessAdapter<Process>
  readonly current: DesktopServiceState<Process>
  readonly closed: Deferred.Deferred<void>
  readonly ready: Deferred.Deferred<Process, DesktopServiceError>
  readonly scope: Scope.Closeable
}): readonly [StartDecision<Process>, DesktopServiceState<Process>] {
  const { adapter, closed, current, ready, scope } = options
  const record = current.current
  if (record?.status === 'Running' && adapter.isRunning(record.process))
    return [{ status: 'Ready', process: record.process }, current]
  if (record?.status === 'Starting') return [{ status: 'Wait', ready: record.ready }, current]
  if (record?.status === 'Stopping')
    return [{ status: 'WaitClosed', closed: record.closed }, current]

  const next: ServiceRecord<Process> = {
    id: current.nextRecordId,
    status: 'Starting',
    scope,
    ready,
    closed,
    process: null,
    pendingRequests: new Map(),
  }
  return [
    { status: 'Start', stale: record },
    { current: next, nextRecordId: current.nextRecordId + 1 },
  ]
}

export function makeDesktopServiceLifecycle<Process>(options: {
  readonly adapter: DesktopServiceProcessAdapter<Process>
  readonly client: DesktopServiceClientOptions
  readonly events: PubSub.PubSub<DesktopEvent>
  readonly state: Ref.Ref<DesktopServiceState<Process>>
  readonly terminal: TerminalRpcBridge<Process>
}) {
  return Effect.gen(function* () {
    const { adapter, client, events, state, terminal } = options
    const rootScope = yield* Scope.Scope
    const runCallback = yield* FiberSet.makeRuntime<never, unknown, never>()
    const publishDiagnostic = (input: Parameters<typeof diagnosticEvent>[0]) =>
      PubSub.publish(events, diagnosticEvent(input))

    const rejectPending = Effect.fn('DesktopService.rejectPending')(function* (
      pending: Iterable<PendingRequest>,
      error: DesktopServiceError,
    ) {
      yield* Effect.forEach(pending, (request) => Deferred.fail(request.response, error), {
        discard: true,
      })
    })

    const finalizeRecord = Effect.fn('DesktopService.finalizeRecord')(function* (
      record: ServiceRecord<Process>,
    ) {
      yield* Scope.close(record.scope, Exit.void)
      if (record.process) yield* terminal.dispose(record.process)
      yield* Ref.update(state, (current) => detachCurrent(current, record.id))
      yield* Deferred.succeed(record.closed, undefined)
    })

    const claimStop = Effect.fn('DesktopService.claimStop')(function* (
      recordId: number,
      process?: Process | undefined,
    ) {
      return yield* Ref.modify(state, (current) => {
        const record = current.current
        if (!record || record.id !== recordId || record.status === 'Stopping')
          return [null, current] as const
        if (process !== undefined && record.process !== process) return [null, current] as const
        return [
          { ...record, status: 'Stopping' as const },
          updateCurrent(current, record.id, (active) => ({ ...active, status: 'Stopping' })),
        ] as const
      })
    })

    const failAndFinalize = Effect.fn('DesktopService.failAndFinalize')(function* (
      record: ServiceRecord<Process>,
      error: DesktopServiceError,
      diagnostic?: Parameters<typeof diagnosticEvent>[0] | undefined,
    ) {
      yield* rejectPending(record.pendingRequests.values(), error)
      yield* Deferred.fail(record.ready, error)
      if (diagnostic) yield* publishDiagnostic(diagnostic)
      yield* finalizeRecord(record)
    })

    const handleExit = Effect.fn('DesktopService.handleExit')(function* (
      process: Process,
      code: number | null,
      signal: NodeJS.Signals | null,
    ) {
      const current = (yield* Ref.get(state)).current
      if (!current || current.process !== process) return
      const record = yield* claimStop(current.id, process)
      if (!record) return
      const wasReady = current.status === 'Running'
      yield* failAndFinalize(record, serviceError('exit', new Error('Desktop service exited.')), {
        severity: wasReady ? 'warning' : 'error',
        message: wasReady
          ? 'Desktop runtime service exited. It will restart on the next request.'
          : 'Desktop runtime service exited before startup.',
        details: { code, signal },
      })
    })

    const startRecord = Effect.fn('DesktopService.startRecord')(function* (
      record: ServiceRecord<Process>,
      handleMessage: ServiceMessageHandler<Process>,
    ) {
      const spawned = yield* Effect.acquireRelease(
        adapter.spawn({
          onExit: (process, code, signal) => {
            runCallback(handleExit(process, code, signal))
          },
          onMessage: (process, message) => {
            runCallback(
              handleMessage(process, message).pipe(
                Effect.catch((error) =>
                  Effect.sync(() => console.error('Desktop service message failed.', error)),
                ),
              ),
            )
          },
        }),
        (handle) => adapter.terminate(handle.process),
      ).pipe(Scope.provide(record.scope))

      const attached = yield* Ref.modify(state, (current) => {
        const active = current.current
        if (!active || active.id !== record.id || active.status !== 'Starting')
          return [false, current] as const
        return [
          true,
          updateCurrent(current, record.id, (value) => ({ ...value, process: spawned.process })),
        ] as const
      })
      if (!attached)
        return yield* Effect.fail(serviceError('start', new Error('Service start was cancelled.')))

      const diagnostics = yield* spawned.ready
      yield* terminal.connect(spawned.process)
      const running = yield* Ref.modify(state, (current) => {
        const active = current.current
        if (!active || active.id !== record.id || active.status !== 'Starting')
          return [false, current] as const
        return [
          true,
          updateCurrent(current, record.id, (value) => ({
            ...value,
            status: 'Running',
            process: spawned.process,
          })),
        ] as const
      })
      if (!running)
        return yield* Effect.fail(serviceError('start', new Error('Service start was cancelled.')))
      yield* Effect.sync(() => console.info('Desktop service ready.', diagnostics))
      yield* Deferred.succeed(record.ready, spawned.process)
    })

    const runStartup = (
      record: ServiceRecord<Process>,
      handleMessage: ServiceMessageHandler<Process>,
    ) =>
      startRecord(record, handleMessage).pipe(
        Effect.timeoutOrElse({
          duration: client.startupTimeoutMs ?? 15_000,
          orElse: () =>
            Effect.fail(
              serviceError(
                'startupTimeout',
                new Error('Timed out waiting for desktop service startup.'),
              ),
            ),
        }),
        Effect.onExit((exit) => {
          if (Exit.isSuccess(exit)) return Effect.void
          const error = serviceError('start', Cause.squash(exit.cause))
          return Effect.gen(function* () {
            const owned = yield* claimStop(record.id)
            yield* Deferred.fail(record.ready, error)
            if (!owned) return
            yield* Effect.sync(() =>
              runCallback(
                failAndFinalize(owned, error, {
                  severity: 'error',
                  message: 'Desktop runtime service failed to start.',
                  details: error.message,
                }),
              ),
            )
          })
        }),
        Effect.catch(() => Effect.void),
      )

    const beginReservedStart = Effect.fn('DesktopService.beginReservedStart')(function* (
      decision: Extract<StartDecision<Process>, { status: 'Start' }>,
      ready: Deferred.Deferred<Process, DesktopServiceError>,
      handleMessage: ServiceMessageHandler<Process>,
    ) {
      if (decision.stale) {
        yield* failAndFinalize(
          decision.stale,
          serviceError('restart', new Error('Desktop service exited.')),
          {
            severity: 'warning',
            message: 'Desktop runtime service exited. It will restart on the next request.',
          },
        )
      }

      const record = (yield* Ref.get(state)).current
      if (!record || record.ready !== ready)
        return yield* Effect.fail(serviceError('start', new Error('Service start was cancelled.')))
      yield* Effect.forkIn(runStartup(record, handleMessage), record.scope)
      return yield* Deferred.await(record.ready)
    })

    let ensureStarted: (
      handleMessage: ServiceMessageHandler<Process>,
    ) => Effect.Effect<Process, DesktopServiceError>
    ensureStarted = Effect.fn('DesktopService.ensureStarted')(function* (handleMessage) {
      const ready = yield* Deferred.make<Process, DesktopServiceError>()
      const closed = yield* Deferred.make<void>()
      const scope = yield* Scope.fork(rootScope)
      const decision = yield* Ref.modify(state, (current) =>
        reserveStart({ adapter, current, closed, ready, scope }),
      )

      if (decision.status !== 'Start') yield* Scope.close(scope, Exit.void)
      switch (decision.status) {
        case 'Ready':
          return decision.process
        case 'Wait':
          return yield* Deferred.await(decision.ready)
        case 'WaitClosed':
          yield* Deferred.await(decision.closed)
          return yield* ensureStarted(handleMessage)
        case 'Start':
          return yield* beginReservedStart(decision, ready, handleMessage)
        default:
          return yield* Effect.die('Unknown desktop service start decision.')
      }
    })

    const dispose = Effect.fn('DesktopService.dispose')(function* () {
      const current = (yield* Ref.get(state)).current
      if (!current) return
      if (current.status === 'Stopping') {
        yield* Deferred.await(current.closed)
        return
      }
      const record = yield* claimStop(current.id)
      if (!record) return
      yield* failAndFinalize(
        record,
        serviceError('dispose', new Error('Desktop service is shutting down.')),
      )
    })

    return {
      currentProcess: Effect.map(Ref.get(state), (current) => current.current?.process ?? null),
      dispose: dispose(),
      ensureStarted,
    }
  })
}
