import type * as Deferred from 'effect/Deferred'
import type * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'
import type { DesktopEvent } from '../../../shared/desktop-contracts.ts'
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostToMainMessage,
  RuntimeMainToHostMessage,
} from '../protocol.ts'

export class RuntimeHostBrokerError extends Schema.TaggedError<RuntimeHostBrokerError>()(
  'RuntimeHostBrokerError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export function brokerError(operation: string, cause: unknown) {
  return new RuntimeHostBrokerError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  })
}

export type HostRole = 'service' | 'thread'

export type PendingRequest = {
  readonly name: RuntimeHostRequestName
  readonly response: Deferred.Deferred<unknown, RuntimeHostBrokerError>
}

export type HostLifecycle<Process> =
  | { readonly status: 'Stopped' }
  | {
      readonly status: 'Starting'
      readonly scope: Scope.Closeable
      readonly ready: Deferred.Deferred<Process, RuntimeHostBrokerError>
      readonly process: Process | null
    }
  | { readonly status: 'Running'; readonly scope: Scope.Closeable; readonly process: Process }
  | {
      readonly status: 'Stopping'
      readonly scope: Scope.Closeable
      readonly process: Process | null
    }

export type HostRecord<Process> = {
  readonly id: string
  readonly role: HostRole
  readonly label: string
  readonly aliases: ReadonlySet<string>
  readonly pendingRequests: ReadonlyMap<string, PendingRequest>
  readonly lifecycle: HostLifecycle<Process>
  readonly busy: boolean
  readonly lastSendComposerPromptAtMs: number | null
}

export type BrokerState<Process> = {
  readonly hosts: ReadonlyMap<string, HostRecord<Process>>
  readonly hostByAlias: ReadonlyMap<string, string>
  readonly serviceHostId: string
  readonly shuttingDown: boolean
}

export type RuntimeHostProcessHandlers<Process> = {
  readonly onExit: (process: Process, code: number | null, signal: NodeJS.Signals | null) => void
  readonly onMessage: (process: Process, message: RuntimeHostToMainMessage) => void
}

export type HostMessageHandler<Process> = (
  hostId: string,
  process: Process,
  message: RuntimeHostToMainMessage,
) => Effect.Effect<void, RuntimeHostBrokerError>

export type SpawnedRuntimeHost<Process> = {
  readonly process: Process
  readonly ready: Effect.Effect<void, RuntimeHostBrokerError>
}

export interface RuntimeHostProcessAdapter<Process> {
  readonly makeId: () => string
  readonly spawn: (
    label: string,
    handlers: RuntimeHostProcessHandlers<Process>,
  ) => Effect.Effect<SpawnedRuntimeHost<Process>, RuntimeHostBrokerError>
  readonly send: (
    process: Process,
    message: RuntimeMainToHostMessage,
  ) => Effect.Effect<void, RuntimeHostBrokerError>
  readonly terminate: (process: Process) => Effect.Effect<void>
  readonly terminateNow: (process: Process) => void
  readonly isRunning: (process: Process) => boolean
  readonly installShutdownHandlers: (
    terminateAll: () => void,
  ) => Effect.Effect<void, never, Scope.Scope>
}

export interface RuntimeHostBroker {
  readonly events: import('effect/Stream').Stream<DesktopEvent>
  readonly ensureServiceHost: Effect.Effect<void, RuntimeHostBrokerError>
  readonly invoke: <TName extends RuntimeHostRequestName>(
    name: TName,
    payload: RuntimeHostRequestMap[TName],
  ) => Effect.Effect<unknown, RuntimeHostBrokerError>
  readonly invalidateSettings: (request: {
    readonly sessionPath?: string | null | undefined
    readonly projectPath?: string | null | undefined
  }) => Effect.Effect<void>
  readonly disposeWorkspace: (request: {
    readonly projectPath: string
    readonly sessionPaths: readonly string[]
  }) => Effect.Effect<void, RuntimeHostBrokerError>
  readonly restart: Effect.Effect<void>
  readonly shutdown: Effect.Effect<void>
}
