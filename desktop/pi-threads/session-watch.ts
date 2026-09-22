import { watch } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import * as Cause from 'effect/Cause'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as FiberHandle from 'effect/FiberHandle'
import * as Queue from 'effect/Queue'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'
import { sessionTreeRefreshWithSessionWatch } from '../../shared/session-tree-watch.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import {
  publishExternalThreadUpdate,
  shouldSuppressExternalThreadUpdate,
} from './external-thread-publisher.ts'
import { loadThreadSnapshot } from './thread-loader.ts'

const WATCH_DEBOUNCE_MS = 140

type WatchState = { sessionPath: string; lastObservedModifiedMs: number }

const refreshWatchedSession = Effect.fn('PiSession.refreshWatched')(function* (state: WatchState) {
  const { sessionPath } = state
  if (shouldSuppressExternalThreadUpdate(sessionPath)) return
  const stats = yield* Effect.tryPromise(() => stat(sessionPath)).pipe(
    Effect.catch(() => Effect.succeed(null)),
  )
  if (!stats || stats.mtimeMs <= state.lastObservedModifiedMs) return
  const snapshot = yield* Effect.tryPromise(() => loadThreadSnapshot(sessionPath))
  state.lastObservedModifiedMs = stats.mtimeMs
  yield* Effect.tryPromise(() =>
    publishExternalThreadUpdate({
      projectId: snapshot.projectId,
      threadId: snapshot.threadId,
      sessionPath,
      thread: snapshot.thread,
      lastModifiedMs: stats.mtimeMs,
    }),
  )
  if (sessionTreeRefreshWithSessionWatch)
    emitDesktopEvent({ type: 'session-tree-refresh', sessionPath })
})

export function makeSessionWatcher() {
  return Effect.gen(function* () {
    const run = yield* FiberHandle.makeRuntime<never, unknown, void>()
    let currentSessionPath: string | null = null
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
      }),
    )

    return (sessionPath: string | null) => {
      if (closed) return Promise.reject(new Error('Pi session watcher is closed.'))
      if (sessionPath === currentSessionPath) return Promise.resolve()
      currentSessionPath = sessionPath
      const ready = Deferred.makeUnsafe<void, unknown>()
      run(
        Effect.scoped(
          Effect.gen(function* () {
            if (!sessionPath) {
              yield* Deferred.succeed(ready, undefined)
              return
            }
            const lastObservedModifiedMs = yield* Effect.tryPromise(() => stat(sessionPath)).pipe(
              Effect.map((stats) => stats.mtimeMs),
              Effect.catch(() => Effect.succeed(0)),
            )
            const changes = yield* Queue.sliding<void>(1)
            const state: WatchState = { sessionPath, lastObservedModifiedMs }
            const watchedFileName = path.basename(sessionPath)
            yield* Effect.acquireRelease(
              Effect.try(() => {
                const watcher = watch(path.dirname(sessionPath), (_eventType, changedFileName) => {
                  if (
                    typeof changedFileName === 'string' &&
                    changedFileName.length > 0 &&
                    changedFileName !== watchedFileName
                  )
                    return
                  Queue.offerUnsafe(changes, undefined)
                })
                watcher.on('error', (error) =>
                  console.warn(`Pi session watcher failed for ${sessionPath}`, error),
                )
                return watcher
              }),
              (watcher) => Effect.sync(() => watcher.close()),
            )
            yield* Deferred.succeed(ready, undefined)
            yield* Stream.fromQueue(changes).pipe(
              Stream.debounce(WATCH_DEBOUNCE_MS),
              Stream.runForEach(() =>
                refreshWatchedSession(state).pipe(
                  Effect.catch((error) =>
                    Effect.sync(() =>
                      console.warn(`Failed to refresh watched Pi session: ${sessionPath}`, error),
                    ),
                  ),
                ),
              ),
            )
            return yield* Effect.never
          }),
        ).pipe(
          Effect.onExit((exit) =>
            Exit.isFailure(exit) && !Cause.hasInterrupts(exit.cause)
              ? Deferred.failCause(ready, exit.cause)
              : Deferred.succeed(ready, undefined),
          ),
        ),
      )
      return Effect.runPromise(Deferred.await(ready))
    }
  })
}

const watcherScope = Scope.makeUnsafe()
export const setWatchedSessionPath = Effect.runSync(
  Scope.provide(makeSessionWatcher(), watcherScope),
)

export function disposeSessionWatcher() {
  return Effect.runPromise(Scope.close(watcherScope, Exit.void))
}
