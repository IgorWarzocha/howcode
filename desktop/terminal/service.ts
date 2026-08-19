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
  TerminalSessionFileStat,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
} from '../../shared/terminal-contracts.ts'
import { TerminalError } from '../../shared/terminal-contracts.ts'
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
  readonly statSessionFile: (
    sessionId: string,
  ) => Effect.Effect<TerminalSessionFileStat | null, TerminalError>
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

function fromPromise<A>(operation: TerminalOperation, evaluate: () => PromiseLike<A>) {
  return Effect.tryPromise({
    try: evaluate,
    catch: (error) => operationError(operation, error),
  })
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const scope = yield* Scope.Scope
    const pty = yield* Pty.Service
    const store = yield* makeTerminalSessionStore
    const manager = makeTerminalManager(store, scope, pty)

    const closeAll = Effect.fn('Terminal.closeAll')(function* () {
      yield* fromPromise('closeAll', manager.closeAllTerminals)
    })
    const close = Effect.fn('Terminal.close')(function* (request: TerminalCloseRequest) {
      yield* fromPromise('close', () => manager.closeTerminal(request))
    })
    const list = Effect.fn('Terminal.list')(function* () {
      return yield* fromPromise('list', manager.listTerminals)
    })
    const open = Effect.fn('Terminal.open')(function* (request: TerminalOpenRequest) {
      return yield* fromPromise('open', () => manager.openTerminal(request))
    })
    const resize = Effect.fn('Terminal.resize')(function* (
      sessionId: string,
      cols: number,
      rows: number,
    ) {
      yield* fromPromise('resize', () => manager.resizeTerminal(sessionId, cols, rows))
    })
    const statSessionFile = Effect.fn('Terminal.statSessionFile')(function* (sessionId: string) {
      return yield* fromPromise('statSessionFile', () => manager.statSessionFile(sessionId))
    })
    const status = Effect.fn('Terminal.status')(function* (sessionId: string) {
      return yield* fromPromise('status', () => manager.getTerminalStatus(sessionId))
    })
    const write = Effect.fn('Terminal.write')(function* (sessionId: string, data: string) {
      yield* fromPromise('write', () => manager.writeTerminal(sessionId, data))
    })

    return Service.of({
      events: store.events,
      eventSubscription: store.subscribe,
      closeAll,
      close,
      list,
      open,
      resize,
      statSessionFile,
      status,
      write,
    })
  }),
)

export const liveLayer = layer.pipe(Layer.provide(Pty.layer))
