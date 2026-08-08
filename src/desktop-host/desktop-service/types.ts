import type * as Deferred from 'effect/Deferred'
import type * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'
import type * as Stream from 'effect/Stream'
import type { DesktopEvent } from '../../../shared/desktop-contracts'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import type { DesktopServiceMessage } from '../../../shared/desktop-service-ipc'
import type { TerminalRpcResponse } from '../../../shared/terminal-rpc'

export type DesktopServiceApi = DesktopServiceRuntime
export type DesktopServiceModuleName = keyof DesktopServiceApi

export type { DesktopServiceMessage } from '../../../shared/desktop-service-ipc'

export type DesktopServiceRequestMessage = {
  readonly type: 'request'
  readonly id: string
  readonly module: DesktopServiceModuleName
  readonly method: string
  readonly args: readonly unknown[]
}

export type DesktopServiceClientOptions = {
  nodeExecutable: string | (() => Promise<string> | string)
  serviceHostPath: string
  cwd: string
  env?: NodeJS.ProcessEnv | undefined
  requestTimeoutMs?: number | undefined
  startupTimeoutMs?: number | undefined
}

export class DesktopServiceError extends Schema.TaggedError<DesktopServiceError>()(
  'DesktopServiceError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export function serviceError(operation: string, cause: unknown) {
  return new DesktopServiceError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  })
}

export type PendingRequest = {
  readonly methodLabel: string
  readonly response: Deferred.Deferred<unknown, DesktopServiceError>
}

type ServiceRecordBase<Process> = {
  readonly id: number
  readonly scope: Scope.Closeable
  readonly ready: Deferred.Deferred<Process, DesktopServiceError>
  readonly closed: Deferred.Deferred<void>
  readonly pendingRequests: ReadonlyMap<string, PendingRequest>
}

export type ServiceRecord<Process> =
  | (ServiceRecordBase<Process> & { readonly status: 'Starting'; readonly process: Process | null })
  | (ServiceRecordBase<Process> & { readonly status: 'Running'; readonly process: Process })
  | (ServiceRecordBase<Process> & { readonly status: 'Stopping'; readonly process: Process | null })

export type DesktopServiceState<Process> = {
  readonly current: ServiceRecord<Process> | null
  readonly nextRecordId: number
}

export type SpawnedDesktopService<Process> = {
  readonly process: Process
  readonly ready: Effect.Effect<Record<string, unknown>, DesktopServiceError>
}

export type DesktopServiceProcessHandlers<Process> = {
  readonly onExit: (process: Process, code: number | null, signal: NodeJS.Signals | null) => void
  readonly onMessage: (process: Process, message: DesktopServiceMessage) => void
}

export type ServiceMessageHandler<Process> = (
  process: Process,
  message: DesktopServiceMessage,
) => Effect.Effect<void, DesktopServiceError>

export interface DesktopServiceProcessAdapter<Process> {
  readonly makeRequestId: () => string
  readonly spawn: (
    handlers: DesktopServiceProcessHandlers<Process>,
  ) => Effect.Effect<SpawnedDesktopService<Process>, DesktopServiceError>
  readonly send: (
    process: Process,
    message: DesktopServiceRequestMessage,
  ) => Effect.Effect<void, DesktopServiceError>
  readonly terminate: (process: Process) => Effect.Effect<void>
  readonly isRunning: (process: Process) => boolean
}

export interface TerminalRpcBridge<Process> {
  readonly connect: (process: Process) => Effect.Effect<void, DesktopServiceError>
  readonly dispose: (process: Process) => Effect.Effect<void>
  readonly write: (message: TerminalRpcResponse) => void
}

export interface DesktopServiceCore<Process> {
  readonly events: Stream.Stream<DesktopEvent>
  readonly currentProcess: Effect.Effect<Process | null>
  readonly ensureStarted: Effect.Effect<Process, DesktopServiceError>
  readonly invoke: (
    moduleName: DesktopServiceModuleName,
    method: string,
    args: readonly unknown[],
  ) => Effect.Effect<unknown, DesktopServiceError>
  readonly dispose: Effect.Effect<void>
}
