import * as Cause from 'effect/Cause'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import { desktopStartupTimeouts } from '../../../shared/desktop-startup-deadlines'
import type { makeDesktopServiceFinalization } from './lifecycle-finalization'
import { updateCurrent } from './state'
import {
  type DesktopServiceClientOptions,
  type DesktopServiceError,
  type DesktopServiceProcessAdapter,
  type DesktopServiceState,
  type ServiceMessageHandler,
  type ServiceRecord,
  serviceError,
  type TerminalRpcBridge,
} from './types'

type RunCallback = (effect: Effect.Effect<unknown, never>) => void

export function makeDesktopServiceStartup<Process>(options: {
  readonly adapter: DesktopServiceProcessAdapter<Process>
  readonly client: DesktopServiceClientOptions
  readonly finalization: ReturnType<typeof makeDesktopServiceFinalization<Process>>
  readonly onReady: (handler: ServiceMessageHandler<Process>) => Effect.Effect<unknown>
  readonly runCallback: RunCallback
  readonly state: Ref.Ref<DesktopServiceState<Process>>
  readonly terminal: TerminalRpcBridge<Process>
}) {
  const { adapter, client, finalization, runCallback, state, terminal } = options
  const { claimStop, failAndFinalize } = finalization

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
        ? 'Desktop runtime service exited. Automatic recovery will restart it.'
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
      { interruptible: true },
    ).pipe(Scope.provide(record.scope))

    const attached = yield* Ref.modify(state, (current) => {
      const active = current.current
      if (current.disposed || !active || active.id !== record.id || active.status !== 'Starting')
        return [false, current] as const
      return [
        true,
        updateCurrent(current, record.id, (value) => ({ ...value, process: spawned.process })),
      ] as const
    })
    if (!attached)
      return yield* Effect.fail(serviceError('start', new Error('Service start was cancelled.')))

    const diagnostics = yield* spawned.ready
    // biome-ignore lint/complexity/useLiteralKeys: Diagnostics are an index-signature contract.
    yield* terminal.connect(spawned.process, diagnostics['terminalAvailable'] === true)
    const running = yield* Ref.modify(state, (current) => {
      const active = current.current
      if (current.disposed || !active || active.id !== record.id || active.status !== 'Starting')
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
    yield* options.onReady(handleMessage)
    yield* Deferred.succeed(record.ready, spawned.process)
  })

  const runStartup = (
    record: ServiceRecord<Process>,
    handleMessage: ServiceMessageHandler<Process>,
  ) =>
    startRecord(record, handleMessage).pipe(
      Effect.timeoutOrElse({
        duration: client.startupTimeoutMs ?? desktopStartupTimeouts.serviceReadyMs,
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
          runCallback(
            failAndFinalize(owned, error, {
              severity: 'error',
              message: 'Desktop runtime service failed to start.',
              details: error.message,
            }),
          )
        })
      }),
      Effect.catch(() => Effect.void),
    )

  const stopStale = (record: ServiceRecord<Process>) =>
    Effect.sync(() =>
      runCallback(
        failAndFinalize(record, serviceError('restart', new Error('Desktop service exited.')), {
          severity: 'warning',
          message: 'Desktop runtime service exited. Starting a replacement.',
        }),
      ),
    )

  const launchReservedStart = Effect.fn('DesktopService.launchReservedStart')(function* (
    ready: Deferred.Deferred<Process, DesktopServiceError>,
    handleMessage: ServiceMessageHandler<Process>,
  ) {
    const active = yield* Ref.get(state)
    const record = active.current
    if (active.disposed || record?.status !== 'Starting' || record.ready !== ready)
      return yield* Effect.fail(serviceError('start', new Error('Service start was cancelled.')))
    yield* Effect.forkIn(runStartup(record, handleMessage), record.scope)
  })

  return { launchReservedStart, stopStale }
}
