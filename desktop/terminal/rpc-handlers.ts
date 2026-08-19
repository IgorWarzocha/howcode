import * as Effect from 'effect/Effect'
import * as Stream from 'effect/Stream'
import { TerminalEventStreamMessage, TerminalRpcGroup } from '../../shared/terminal-rpc.ts'
import type { Interface } from './service.ts'

export function createTerminalRpcHandlers(terminal: Interface) {
  return TerminalRpcGroup.of({
    'terminal.list': terminal.list,
    'terminal.open': terminal.open,
    'terminal.write': ({ sessionId, data }) => terminal.write(sessionId, data),
    'terminal.resize': ({ sessionId, cols, rows }) => terminal.resize(sessionId, cols, rows),
    'terminal.close': terminal.close,
    'terminal.closeAll': terminal.closeAll,
    'terminal.statSessionFile': ({ sessionId }) => terminal.statSessionFile(sessionId),
    'terminal.status': ({ sessionId }) => terminal.status(sessionId),
    'terminal.events': () =>
      Stream.unwrap(
        Effect.gen(function* () {
          const subscription = yield* terminal.eventSubscription
          return Stream.concat(
            Stream.make(TerminalEventStreamMessage.cases.Ready.make({})),
            Stream.fromSubscription(subscription).pipe(
              Stream.map((event) => TerminalEventStreamMessage.cases.Event.make({ event })),
            ),
          )
        }),
      ),
  })
}
