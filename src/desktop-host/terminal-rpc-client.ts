import type { ChildProcess } from 'node:child_process'
import * as Cause from 'effect/Cause'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Queue from 'effect/Queue'
import * as Schema from 'effect/Schema'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'
import type * as RpcClient from 'effect/unstable/rpc/RpcClient'
import * as RpcClientRuntime from 'effect/unstable/rpc/RpcClient'
import { RpcClientDefect, RpcClientError } from 'effect/unstable/rpc/RpcClientError'
import type { TerminalService } from '../../shared/desktop-service-contracts'
import {
  TerminalCloseRequest,
  type TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionFileStatRequest,
  TerminalStatusRequest,
  TerminalWriteRequest,
} from '../../shared/terminal-contracts'
import {
  TerminalRpcGroup,
  type TerminalRpcRequest,
  type TerminalRpcResponse,
} from '../../shared/terminal-rpc'

type Client = RpcClient.FromGroup<typeof TerminalRpcGroup, RpcClientError>

type Connection = {
  child: ChildProcess
  client: Client
  inbound: Queue.Queue<TerminalRpcResponse>
  ready: Deferred.Deferred<void, unknown>
  scope: Scope.Closeable
}

type Options = {
  ensureStarted: () => Promise<ChildProcess>
  onDiagnostic: (message: string, details: unknown) => void
}

type ConnectionAttempt = {
  readonly child: ChildProcess
  scope: Scope.Closeable | null
}

export class TerminalRpcServiceClient {
  private connection: Connection | null = null
  private connectionAttempt: ConnectionAttempt | null = null
  private readonly options: Options
  readonly service: TerminalService

  constructor(options: Options) {
    this.options = options
    this.service = {
      closeAllTerminals: () => this.run((client) => client['terminal.closeAll']({})),
      closeTerminal: (request) =>
        this.run((client) =>
          Schema.decodeUnknownEffect(TerminalCloseRequest)(request).pipe(
            Effect.flatMap((decoded) => client['terminal.close'](decoded)),
          ),
        ),
      getTerminalStatus: (sessionId) =>
        this.run((client) =>
          Schema.decodeUnknownEffect(TerminalStatusRequest)({ sessionId }).pipe(
            Effect.flatMap((decoded) => client['terminal.status'](decoded)),
          ),
        ),
      listTerminals: () => this.run((client) => client['terminal.list']({})),
      openTerminal: (request) =>
        this.run((client) =>
          Schema.decodeUnknownEffect(TerminalOpenRequest)(request).pipe(
            Effect.flatMap((decoded) => client['terminal.open'](decoded)),
          ),
        ),
      resizeTerminal: (sessionId, cols, rows) =>
        this.run((client) =>
          Schema.decodeUnknownEffect(TerminalResizeRequest)({ sessionId, cols, rows }).pipe(
            Effect.flatMap((decoded) => client['terminal.resize'](decoded)),
          ),
        ),
      statSessionFile: (sessionId) =>
        this.run((client) =>
          Schema.decodeUnknownEffect(TerminalSessionFileStatRequest)({ sessionId }).pipe(
            Effect.flatMap((decoded) => client['terminal.statSessionFile'](decoded)),
          ),
        ),
      subscribeTerminalEvents: (listener) => this.subscribe(listener),
      writeTerminal: (sessionId, data) =>
        this.run((client) =>
          Schema.decodeUnknownEffect(TerminalWriteRequest)({ sessionId, data }).pipe(
            Effect.flatMap((decoded) => client['terminal.write'](decoded)),
          ),
        ),
    }
  }

  private readonly listeners = new Set<(event: TerminalEvent) => void>()

  private subscribe(listener: (event: TerminalEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private send(child: ChildProcess, message: unknown) {
    return Effect.callback<void, Error>((resume) => {
      if (!child.connected) {
        resume(Effect.fail(new Error('Desktop service IPC channel is disconnected.')))
        return
      }

      try {
        child.send({ type: 'terminal-rpc-request', message }, (error) => {
          resume(error ? Effect.fail(error) : Effect.void)
        })
      } catch (error) {
        resume(Effect.fail(error instanceof Error ? error : new Error(String(error))))
      }
    })
  }

  async connect(child: ChildProcess) {
    const attempt: ConnectionAttempt = { child, scope: null }
    this.connectionAttempt = attempt
    const previous = this.connection
    this.connection = null
    if (previous) await Effect.runPromise(Scope.close(previous.scope, Exit.void))

    const scope = Scope.makeUnsafe()
    attempt.scope = scope
    const ready = Deferred.makeUnsafe<void, unknown>()
    const sendMessage = (message: TerminalRpcRequest) => this.send(child, message)
    try {
      const connection = await Effect.runPromise(
        Effect.gen(function* () {
          const inbound = yield* Queue.unbounded<TerminalRpcResponse>()
          const protocol = yield* RpcClientRuntime.Protocol.make((writeResponse) =>
            Effect.gen(function* () {
              yield* Stream.fromQueue(inbound).pipe(
                Stream.runForEach((message) => writeResponse(0, message)),
                Effect.forkScoped,
              )
              return {
                send: (_clientId: number, message: TerminalRpcRequest) =>
                  sendMessage(message).pipe(
                    Effect.mapError(
                      (cause) =>
                        new RpcClientError({
                          reason: new RpcClientDefect({
                            message: 'Unable to send terminal RPC message',
                            cause,
                          }),
                        }),
                    ),
                  ),
                supportsAck: false,
                supportsTransferables: false,
              }
            }),
          )
          const client = yield* RpcClientRuntime.make(TerminalRpcGroup).pipe(
            Effect.provideService(RpcClientRuntime.Protocol, protocol),
          )
          return { child, client, inbound, ready, scope }
        }).pipe(Effect.provideService(Scope.Scope, scope)),
      )

      if (this.connectionAttempt !== attempt || !child.connected) {
        throw new Error('Desktop service exited while terminal RPC was starting.')
      }

      this.connectionAttempt = null
      this.connection = connection
      const reportStoppedStream = (error: unknown) => {
        if (this.connection?.scope !== scope) return
        this.options.onDiagnostic(
          'Terminal event stream stopped.',
          error instanceof Error ? error.message : String(error),
        )
      }
      const consumeEvents = connection.client['terminal.events']({}).pipe(
        Stream.runForEach((message) =>
          message._tag === 'Ready'
            ? Deferred.succeed(ready, undefined)
            : Effect.sync(() => {
                for (const listener of this.listeners) listener(message.event)
              }),
        ),
        Effect.catchCause((cause) =>
          Effect.gen(function* () {
            const error = Cause.squash(cause)
            yield* Deferred.fail(ready, error)
            yield* Effect.sync(() => reportStoppedStream(error))
          }),
        ),
        Effect.andThen(
          Deferred.fail(ready, new Error('Terminal event stream ended before becoming ready.')),
        ),
      )
      await Effect.runPromise(Effect.forkIn(consumeEvents, scope))
      await Effect.runPromise(Deferred.await(ready))
      if (this.connection?.scope !== scope) {
        throw new Error('Desktop service exited while terminal RPC was starting.')
      }
    } catch (error) {
      if (this.connectionAttempt === attempt) this.connectionAttempt = null
      if (this.connection?.scope === scope) this.connection = null
      await Effect.runPromise(Scope.close(scope, Exit.void))
      throw error
    }
  }

  async dispose(child?: ChildProcess | undefined) {
    const attempt = this.connectionAttempt
    const connection = this.connection
    const disposeAttempt = attempt && (!child || attempt.child === child) ? attempt : null
    const disposeConnection =
      connection && (!child || connection.child === child) ? connection : null
    if (!(disposeAttempt || disposeConnection)) return

    if (disposeAttempt && this.connectionAttempt === disposeAttempt) this.connectionAttempt = null
    if (disposeConnection && this.connection === disposeConnection) this.connection = null
    if (disposeConnection) {
      await Effect.runPromise(
        Deferred.fail(
          disposeConnection.ready,
          new Error('Desktop service exited while terminal RPC was starting.'),
        ),
      )
    }
    const scopes = new Set(
      [disposeAttempt?.scope, disposeConnection?.scope].filter(
        (scope): scope is Scope.Closeable => scope !== null && scope !== undefined,
      ),
    )
    await Promise.all([...scopes].map((scope) => Effect.runPromise(Scope.close(scope, Exit.void))))
  }

  write(message: TerminalRpcResponse) {
    const inbound = this.connection?.inbound
    if (inbound) Queue.offerUnsafe(inbound, message)
  }

  private async run<A, E>(evaluate: (client: Client) => Effect.Effect<A, E>): Promise<A> {
    const child = await this.options.ensureStarted()
    const connection = this.connection
    if (!connection || connection.child !== child) {
      throw new Error('Terminal RPC client is unavailable.')
    }
    return await Effect.runPromise(evaluate(connection.client))
  }
}
