import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Fiber from 'effect/Fiber'
import * as FiberMap from 'effect/FiberMap'
import * as Option from 'effect/Option'
import * as Scope from 'effect/Scope'
import { withDirectoryActivity } from '../../../desktop/runtime/directory-activity.ts'
import type {
  TerminalCloseRequest,
  TerminalOpenRequest,
  TerminalSessionSnapshot,
  TerminalStatusSnapshot,
} from '../../../shared/terminal-contracts.ts'
import { findUnboundWorkspaceShellTerminal } from './session-binding.ts'
import { nowIso } from './session-history.ts'
import { makeSessionId } from './session-id.ts'
import {
  createTerminalRecord,
  ensureProcessStarted,
  isRestartableTerminalStatus,
  rebindWorkspaceTerminal,
  reopenExistingTerminal,
} from './session-lifecycle.ts'
import type { TerminalSessionStore } from './session-store.ts'
import { clearTerminalHistory, didSubmitClear, rememberTerminalInput } from './terminal-input.ts'
import type { PtyAdapter } from './types.ts'

export interface TerminalManager {
  readonly closeAllTerminals: () => Effect.Effect<void, unknown>
  readonly closeTerminal: (request: TerminalCloseRequest) => Effect.Effect<void, unknown>
  readonly getTerminalStatus: (sessionId: string) => Effect.Effect<TerminalStatusSnapshot>
  readonly listTerminals: () => Effect.Effect<TerminalSessionSnapshot[]>
  readonly openTerminal: (
    request: TerminalOpenRequest,
  ) => Effect.Effect<TerminalSessionSnapshot, unknown>
  readonly resizeTerminal: (sessionId: string, cols: number, rows: number) => Effect.Effect<void>
  readonly writeTerminal: (sessionId: string, data: string) => Effect.Effect<void, unknown>
}

export function makeTerminalManager(
  store: TerminalSessionStore,
  rootScope: Scope.Scope,
  adapter: PtyAdapter,
) {
  return Effect.gen(function* () {
    // Opens drain before the session scope closes, including records still loading history.
    const sessionsScope = yield* Scope.fork(rootScope)
    const openingSessions = yield* FiberMap.make<
      string,
      Exit.Exit<TerminalSessionSnapshot, unknown>,
      never
    >()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        closed = true
        yield* FiberMap.awaitEmpty(openingSessions)
      }),
    )

    async function openUnreservedTerminal(
      request: TerminalOpenRequest,
      sessionId: string,
    ): Promise<TerminalSessionSnapshot> {
      const existing = store.get(sessionId)
      if (existing) return reopenExistingTerminal({ store, adapter, record: existing, request })

      const unboundWorkspaceTerminal = findUnboundWorkspaceShellTerminal(store, request)
      if (unboundWorkspaceTerminal) {
        return rebindWorkspaceTerminal({
          store,
          adapter,
          record: unboundWorkspaceTerminal,
          request,
          sessionId,
        })
      }

      return createTerminalRecord({ store, rootScope: sessionsScope, adapter, request, sessionId })
    }

    const openTerminal = Effect.fn('TerminalManager.open')(function* (
      request: TerminalOpenRequest,
    ) {
      // Workspace admission owns a Promise callback boundary outside the terminal runtime.
      return yield* Effect.tryPromise({
        try: () =>
          withDirectoryActivity(request.directoryId, async () => {
            const sessionId = makeSessionId(request)
            return Effect.runPromise(
              Effect.gen(function* () {
                if (closed) return yield* Effect.fail(new Error('Terminal manager is closed.'))
                const pending = FiberMap.getUnsafe(openingSessions, sessionId)
                if (Option.isSome(pending)) return yield* Effect.flatten(Fiber.join(pending.value))
                const opening = yield* FiberMap.run(
                  openingSessions,
                  sessionId,
                  Effect.tryPromise({
                    try: () => openUnreservedTerminal(request, sessionId),
                    catch: (error) => error,
                  }).pipe(Effect.exit, Effect.uninterruptible),
                )
                return yield* Effect.flatten(Fiber.join(opening))
              }),
            )
          }),
        catch: (error) => error,
      })
    })

    const writeTerminal = Effect.fn('TerminalManager.write')(function* (
      sessionId: string,
      data: string,
    ) {
      const record = store.get(sessionId)
      if (!record) return
      const input = rememberTerminalInput(store, record, data)
      if (data.length === 0) return

      if (!record.process && isRestartableTerminalStatus(record.snapshot.status)) {
        record.snapshot = {
          ...record.snapshot,
          status: 'starting',
          exitCode: null,
          exitSignal: null,
          updatedAt: nowIso(),
        }
        yield* ensureProcessStarted(store, adapter, record, 'restarted')
      }

      record.process?.write(data)
      if (didSubmitClear(input)) clearTerminalHistory(store, record)
    }, Effect.uninterruptible)

    const resizeTerminal = Effect.fn('TerminalManager.resize')(
      (sessionId: string, cols: number, rows: number) =>
        Effect.sync(() => {
          const record = store.get(sessionId)
          if (!record) return
          record.snapshot = { ...record.snapshot, cols, rows, updatedAt: nowIso() }
          record.process?.resize(cols, rows)
        }),
    )

    const listTerminals = Effect.fn('TerminalManager.list')(() =>
      Effect.sync(() => store.list().map((record) => record.snapshot)),
    )

    const getTerminalStatus = Effect.fn('TerminalManager.status')((sessionId: string) =>
      Effect.sync(() => {
        const record = store.get(sessionId)
        return record ? { sessionId, status: record.snapshot.status } : null
      }),
    )

    const closeTerminal = Effect.fn('TerminalManager.close')(function* (
      request: TerminalCloseRequest,
    ) {
      const record = store.get(request.sessionId)
      if (!record) return
      record.deleteHistoryOnClose = request.deleteHistory === true
      record.forceKillOnClose = request.force === true
      yield* Scope.close(record.scope, Exit.void)
    })

    const closeAllTerminals = Effect.fn('TerminalManager.closeAll')(function* () {
      yield* FiberMap.awaitEmpty(openingSessions)
      const sessionIds = store.list().map((record) => record.snapshot.sessionId)
      const exits = yield* Effect.forEach(
        sessionIds,
        (sessionId) => closeTerminal({ sessionId }).pipe(Effect.exit),
        {
          concurrency: 'unbounded',
        },
      )
      yield* Effect.forEach(exits, (exit) => exit, { discard: true })
    }, Effect.uninterruptible)

    return {
      closeAllTerminals,
      closeTerminal,
      getTerminalStatus,
      listTerminals,
      openTerminal,
      resizeTerminal,
      writeTerminal,
    } satisfies TerminalManager
  })
}
