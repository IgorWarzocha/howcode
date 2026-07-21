import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import * as Scope from 'effect/Scope'
import type { DesktopEvent } from '../../../shared/desktop-contracts'
import { type DiagnosticInput, diagnosticEvent } from './lifecycle-state'
import { detachCurrent, updateCurrent } from './state'
import type {
  DesktopServiceError,
  DesktopServiceState,
  PendingRequest,
  ServiceRecord,
  TerminalRpcBridge,
} from './types'

export function makeDesktopServiceFinalization<Process>(options: {
  readonly events: PubSub.PubSub<DesktopEvent>
  readonly state: Ref.Ref<DesktopServiceState<Process>>
  readonly terminal: TerminalRpcBridge<Process>
}) {
  const { events, state, terminal } = options

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
    diagnostic?: DiagnosticInput | undefined,
  ) {
    yield* rejectPending(record.pendingRequests.values(), error)
    yield* Deferred.fail(record.ready, error)
    if (diagnostic) yield* PubSub.publish(events, diagnosticEvent(diagnostic))
    yield* finalizeRecord(record)
  })

  return { claimStop, failAndFinalize }
}
