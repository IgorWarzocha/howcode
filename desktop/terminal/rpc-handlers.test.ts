import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as PubSub from 'effect/PubSub'
import * as Queue from 'effect/Queue'
import * as Schema from 'effect/Schema'
import * as Stream from 'effect/Stream'
import * as RpcClient from 'effect/unstable/rpc/RpcClient'
import { RpcClientDefect, RpcClientError } from 'effect/unstable/rpc/RpcClientError'
import { describe, expect, it } from 'vitest'
import {
  TerminalError,
  type TerminalEvent,
  TerminalOpenRequest,
  type TerminalSessionSnapshot,
} from '../../shared/terminal-contracts.ts'
import { TerminalRpcGroup, type TerminalRpcResponse } from '../../shared/terminal-rpc.ts'
import { createTerminalRpcServer } from './rpc-server.ts'
import type { Interface } from './service.ts'

const snapshot: TerminalSessionSnapshot = {
  sessionId: 'terminal-1',
  projectId: '/workspace/project',
  sessionPath: null,
  cwd: '/workspace/project',
  launchMode: 'shell',
  status: 'running',
  pid: 42,
  cols: 120,
  rows: 40,
  history: '',
  hasVisibleContent: true,
  exitCode: null,
  exitSignal: null,
  updatedAt: '2026-03-21T00:00:00.000Z',
}

function jsonRoundTrip<A>(value: A): A {
  return JSON.parse(JSON.stringify(value))
}

function transportError(cause: unknown) {
  return new RpcClientError({
    reason: new RpcClientDefect({ message: 'Test transport failed', cause }),
  })
}

describe('terminal Effect RPC', () => {
  it('rejects malformed terminal input at the schema boundary', async () => {
    const result = await Effect.runPromiseExit(
      Schema.decodeUnknownEffect(TerminalOpenRequest)({
        projectId: '/workspace/project',
        cols: 0,
        rows: 40,
      }),
    )

    expect(result._tag).toBe('Failure')
  })

  it('carries calls, typed failures, and streamed events through JSON IPC', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const streamReady = yield* Deferred.make<void>()
          const terminalEvents = yield* PubSub.unbounded<TerminalEvent>()
          let closeAllCount = 0

          const terminal = {
            events: Stream.fromPubSub(terminalEvents),
            eventSubscription: PubSub.subscribe(terminalEvents),
            closeAll: () =>
              Effect.sync(() => {
                closeAllCount += 1
              }),
            close: () => Effect.void,
            status: (sessionId) => Effect.succeed({ sessionId, status: 'running' as const }),
            list: () => Effect.succeed([snapshot]),
            open: () =>
              Effect.fail(new TerminalError({ operation: 'open', message: 'PTY unavailable' })),
            resize: () => Effect.void,
            statSessionFile: () => Effect.succeed(null),
            write: () => Effect.void,
          } satisfies Interface

          const responses = yield* Queue.unbounded<TerminalRpcResponse>()
          const server = yield* Effect.acquireRelease(
            Effect.promise(() =>
              createTerminalRpcServer(terminal, (message) => {
                Queue.offerUnsafe(responses, jsonRoundTrip(message))
              }),
            ),
            (activeServer) => Effect.promise(() => activeServer.dispose()),
          )
          const protocol = yield* RpcClient.Protocol.make((writeResponse) =>
            Effect.gen(function* () {
              yield* Stream.fromQueue(responses).pipe(
                Stream.runForEach((message) => writeResponse(0, message)),
                Effect.forkScoped,
              )
              return {
                send: (_clientId, message) =>
                  Effect.tryPromise({
                    try: () => server.write(jsonRoundTrip(message)),
                    catch: transportError,
                  }),
                supportsAck: false,
                supportsTransferables: false,
              }
            }),
          )
          const client = yield* RpcClient.make(TerminalRpcGroup).pipe(
            Effect.provideService(RpcClient.Protocol, protocol),
          )

          const listed = yield* client['terminal.list']({})
          expect(listed).toEqual([snapshot])

          yield* client['terminal.closeAll']({})
          expect(closeAllCount).toBe(1)

          const failure = yield* client['terminal.open']({
            projectId: '/workspace/project',
            cols: 120,
            rows: 40,
          }).pipe(Effect.flip)
          expect(failure._tag).toBe('TerminalError')
          if (failure._tag !== 'TerminalError') throw failure
          expect(failure.operation).toBe('open')
          expect(failure.message).toBe('PTY unavailable')

          const eventFiber = yield* client['terminal.events']({}).pipe(
            Stream.tap((message) =>
              message._tag === 'Ready' ? Deferred.succeed(streamReady, undefined) : Effect.void,
            ),
            Stream.take(2),
            Stream.runCollect,
            Effect.forkScoped,
          )
          yield* Deferred.await(streamReady)
          yield* PubSub.publish(terminalEvents, {
            type: 'output',
            sessionId: snapshot.sessionId,
            data: 'hello',
            createdAt: '2026-03-21T00:00:01.000Z',
          })
          const events = yield* Fiber.join(eventFiber)
          const eventMessages = Array.from(events)
          expect(eventMessages.map((message) => message._tag)).toEqual(['Ready', 'Event'])
          const eventMessage = eventMessages[1]
          if (eventMessage?._tag !== 'Event') throw eventMessage
          expect(eventMessage.event).toEqual({
            type: 'output',
            sessionId: snapshot.sessionId,
            data: 'hello',
            createdAt: '2026-03-21T00:00:01.000Z',
          })
        }),
      ),
    )
  })
})
