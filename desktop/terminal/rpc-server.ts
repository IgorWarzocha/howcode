import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Option from 'effect/Option'
import * as Queue from 'effect/Queue'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'
import * as RpcServer from 'effect/unstable/rpc/RpcServer'
import type { TerminalService } from '../../shared/desktop-service-contracts.ts'
import {
  TerminalRpcGroup,
  type TerminalRpcRequest,
  type TerminalRpcResponse,
} from '../../shared/terminal-rpc.ts'
import { createTerminalRpcHandlers } from './rpc-handlers.ts'

export async function createTerminalRpcServer(
  terminal: TerminalService,
  send: (message: TerminalRpcResponse) => void,
) {
  const scope = Scope.makeUnsafe()
  const handlers = Effect.runSync(TerminalRpcGroup.toHandlers(createTerminalRpcHandlers(terminal)))
  const context = Context.add(handlers, Scope.Scope, scope)
  const inbound = await Effect.runPromiseWith(context)(
    Effect.gen(function* () {
      const requests = yield* Queue.unbounded<{
        clientId: number
        message: TerminalRpcRequest
      }>()
      const disconnects = yield* Queue.unbounded<number>()
      const clientIds = new Set([0])
      const protocol = yield* RpcServer.Protocol.make((writeRequest) =>
        Effect.gen(function* () {
          yield* Stream.fromQueue(requests).pipe(
            Stream.runForEach(({ clientId, message }) => writeRequest(clientId, message)),
            Effect.forkScoped,
          )
          return {
            clientIds: Effect.succeed(clientIds),
            disconnects,
            end: (clientId: number) => Effect.sync(() => clientIds.delete(clientId)),
            initialMessage: Effect.succeed(Option.none()),
            send: (_clientId: number, message: TerminalRpcResponse) =>
              Effect.sync(() => send(message)),
            supportsAck: false,
            supportsSpanPropagation: false,
            supportsTransferables: false,
          }
        }),
      )
      yield* RpcServer.make(TerminalRpcGroup).pipe(
        Effect.provideService(RpcServer.Protocol, protocol),
        Effect.forkScoped,
      )
      return requests
    }),
  )

  return {
    dispose: () => Effect.runPromise(Scope.close(scope, Exit.void)),
    write: (message: TerminalRpcRequest) =>
      Effect.runPromise(Queue.offer(inbound, { clientId: 0, message })),
  }
}
