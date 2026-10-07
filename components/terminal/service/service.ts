import * as Cause from 'effect/Cause'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type * as PubSub from 'effect/PubSub'
import * as Scope from 'effect/Scope'
import type * as Stream from 'effect/Stream'
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalOperation,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
} from '../../../shared/terminal-contracts.ts'
import { TerminalError } from '../../../shared/terminal-contracts.ts'
import { makeTerminalManager } from './manager.ts'
import * as Pty from './pty-service.ts'
import { makeTerminalSessionStore } from './session-store.ts'

export interface Interface {
  readonly events: Stream.Stream<TerminalEvent>
  readonly eventSubscription: Effect.Effect<PubSub.Subscription<TerminalEvent>, never, Scope.Scope>
  readonly closeAll: () => Effect.Effect<void, TerminalError>
  readonly close: (request: TerminalCloseRequest) => Effect.Effect<void, TerminalError>
  readonly list: () => Effect.Effect<TerminalSessionSnapshot[], TerminalError>
  readonly open: (
    request: TerminalOpenRequest,
  ) => Effect.Effect<TerminalSessionSnapshot, TerminalError>
  readonly resize: (
    sessionId: string,
    cols: number,
    rows: number,
  ) => Effect.Effect<void, TerminalError>
  readonly status: (sessionId: string) => Effect.Effect<TerminalStatusSnapshot, TerminalError>
  readonly write: (sessionId: string, data: string) => Effect.Effect<void, TerminalError>
}

export class Service extends Context.Service<Service, Interface>()('@howcode/Terminal') {}

function operationError(operation: TerminalOperation, error: unknown) {
  return new TerminalError({
    operation,
    message: error instanceof Error ? error.message : String(error),
  })
}

function operationEffect<A>(operation: TerminalOperation, effect: Effect.Effect<A, unknown>) {
  return effect.pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterrupts(cause)
        ? Effect.interrupt
        : Effect.fail(operationError(operation, Cause.squash(cause))),
    ),
  )
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const scope = yield* Scope.Scope
    const pty = yield* Pty.Service
    const store = yield* makeTerminalSessionStore
    const manager = yield* makeTerminalManager(store, scope, pty)

    const closeAll = Effect.fn('Terminal.closeAll')(function* () {
      yield* operationEffect('closeAll', manager.closeAllTerminals())
    })
    const close = Effect.fn('Terminal.close')(function* (request: TerminalCloseRequest) {
      yield* operationEffect('close', manager.closeTerminal(request))
    })
    const list = Effect.fn('Terminal.list')(function* () {
      return yield* operationEffect('list', manager.listTerminals())
    })
    const open = Effect.fn('Terminal.open')(function* (request: TerminalOpenRequest) {
      return yield* operationEffect('open', manager.openTerminal(request))
    })
    const resize = Effect.fn('Terminal.resize')(function* (
      sessionId: string,
      cols: number,
      rows: number,
    ) {
      yield* operationEffect('resize', manager.resizeTerminal(sessionId, cols, rows))
    })
    const status = Effect.fn('Terminal.status')(function* (sessionId: string) {
      return yield* operationEffect('status', manager.getTerminalStatus(sessionId))
    })
    const write = Effect.fn('Terminal.write')(function* (sessionId: string, data: string) {
      yield* operationEffect('write', manager.writeTerminal(sessionId, data))
    })

    return Service.of({
      events: store.events,
      eventSubscription: store.subscribe,
      closeAll,
      close,
      list,
      open,
      resize,
      status,
      write,
    })
  }),
)

export const liveLayer = layer.pipe(Layer.provide(Pty.layer))
