import type * as Deferred from 'effect/Deferred'
import type * as Scope from 'effect/Scope'
import type { DesktopEvent } from '../../../shared/desktop-contracts'
import type {
  DesktopServiceError,
  DesktopServiceProcessAdapter,
  DesktopServiceState,
  ServiceRecord,
} from './types'

export type StartDecision<Process> =
  | { readonly status: 'Ready'; readonly process: Process }
  | { readonly status: 'Wait'; readonly ready: Deferred.Deferred<Process, DesktopServiceError> }
  | { readonly status: 'WaitClosed'; readonly closed: Deferred.Deferred<void> }
  | { readonly status: 'Start'; readonly stale: ServiceRecord<Process> | null }

export type DiagnosticInput = {
  readonly severity: 'warning' | 'error'
  readonly message: string
  readonly details?: unknown
}

export function diagnosticEvent(input: DiagnosticInput): DesktopEvent {
  return {
    type: 'runtime-diagnostic',
    severity: input.severity,
    message: input.message,
    ...(input.details === undefined ? {} : { details: input.details }),
  }
}

export function reserveStart<Process>(options: {
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
