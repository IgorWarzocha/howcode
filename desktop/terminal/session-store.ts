import * as Effect from 'effect/Effect'
import * as PubSub from 'effect/PubSub'
import * as Ref from 'effect/Ref'
import * as Stream from 'effect/Stream'
import type { TerminalEvent } from '../../shared/terminal-contracts.ts'
import type { TerminalSessionRecord } from './session-record.ts'

export interface TerminalSessionStore {
  readonly events: Stream.Stream<TerminalEvent>
  readonly subscribe: Effect.Effect<
    PubSub.Subscription<TerminalEvent>,
    never,
    import('effect/Scope').Scope
  >
  readonly delete: (sessionId: string) => void
  readonly deleteRecord: (record: TerminalSessionRecord) => void
  readonly emit: (event: TerminalEvent) => void
  readonly get: (sessionId: string) => TerminalSessionRecord | null
  readonly list: () => TerminalSessionRecord[]
  readonly set: (sessionId: string, record: TerminalSessionRecord) => void
}

export const makeTerminalSessionStore = Effect.gen(function* () {
  const events = yield* PubSub.unbounded<TerminalEvent>()
  const sessions = yield* Ref.make<ReadonlyMap<string, TerminalSessionRecord>>(new Map())
  const updateSessions = (
    update: (
      sessions: ReadonlyMap<string, TerminalSessionRecord>,
    ) => ReadonlyMap<string, TerminalSessionRecord>,
  ) => Effect.runSync(Ref.update(sessions, update))

  yield* Effect.addFinalizer(() => PubSub.shutdown(events))

  return {
    events: Stream.fromPubSub(events),
    subscribe: PubSub.subscribe(events),
    delete: (sessionId) => {
      updateSessions((current) => {
        const next = new Map(current)
        next.delete(sessionId)
        return next
      })
    },
    deleteRecord: (record) => {
      updateSessions(
        (current) => new Map([...current].filter(([, candidate]) => candidate !== record)),
      )
    },
    emit: (event) => {
      PubSub.publishUnsafe(events, event)
    },
    get: (sessionId) => Ref.getUnsafe(sessions).get(sessionId) ?? null,
    list: () => [...Ref.getUnsafe(sessions).values()],
    set: (sessionId, record) => {
      updateSessions((current) => new Map(current).set(sessionId, record))
    },
  } satisfies TerminalSessionStore
})
