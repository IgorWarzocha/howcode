import * as Effect from 'effect/Effect'
import * as Queue from 'effect/Queue'
import * as Stream from 'effect/Stream'
import type { TerminalService } from '../../shared/desktop-service-contracts.ts'
import { TerminalError, type TerminalOperation } from '../../shared/terminal-contracts.ts'
import { TerminalEventStreamMessage, TerminalRpcGroup } from '../../shared/terminal-rpc.ts'

function terminalFailure(operation: TerminalOperation, error: unknown) {
  return new TerminalError({
    operation,
    message: error instanceof Error ? error.message : String(error),
  })
}

function terminalPromise<A>(operation: TerminalOperation, evaluate: () => PromiseLike<A>) {
  return Effect.tryPromise({
    try: evaluate,
    catch: (error) => terminalFailure(operation, error),
  })
}

export function createTerminalRpcHandlers(terminal: TerminalService) {
  return TerminalRpcGroup.of({
    'terminal.list': () => terminalPromise('list', terminal.listTerminals),
    'terminal.open': (request) => terminalPromise('open', () => terminal.openTerminal(request)),
    'terminal.write': ({ sessionId, data }) =>
      terminalPromise('write', () => terminal.writeTerminal(sessionId, data)),
    'terminal.resize': ({ sessionId, cols, rows }) =>
      terminalPromise('resize', () => terminal.resizeTerminal(sessionId, cols, rows)),
    'terminal.close': (request) => terminalPromise('close', () => terminal.closeTerminal(request)),
    'terminal.closeAll': () => terminalPromise('closeAll', terminal.closeAllTerminals),
    'terminal.statSessionFile': ({ sessionId }) =>
      terminalPromise('statSessionFile', () => terminal.statSessionFile(sessionId)),
    'terminal.status': ({ sessionId }) =>
      terminalPromise('status', () => terminal.getTerminalStatus(sessionId)),
    'terminal.events': () =>
      Stream.callback((queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const unsubscribe = terminal.subscribeTerminalEvents((event) =>
              Queue.offerUnsafe(queue, TerminalEventStreamMessage.cases.Event.make({ event })),
            )
            Queue.offerUnsafe(queue, TerminalEventStreamMessage.cases.Ready.make({}))
            return unsubscribe
          }),
          (unsubscribe) => Effect.sync(unsubscribe),
        ),
      ),
  })
}
