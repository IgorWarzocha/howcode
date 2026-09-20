import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Fiber from 'effect/Fiber'
import * as FiberMap from 'effect/FiberMap'
import * as Option from 'effect/Option'
import * as Scope from 'effect/Scope'
import { importProjectWorktreesForProjectIds } from '../project-import.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { syncSessionSummaries } from '../thread-state-db.ts'
import { listAllSessionsStrict, mapSessionSummaryToRecord } from './session-index.ts'

type ShellIndexSyncResult = {
  complete: boolean
  didSync: boolean
}

async function syncShellIndex(cwd: string): Promise<ShellIndexSyncResult> {
  const { sessions, partialFailure } = await listAllSessionsStrict()
  const sessionRecords = sessions.map((session) => mapSessionSummaryToRecord(cwd, session))
  await importProjectWorktreesForProjectIds(sessionRecords.map((session) => session.cwd))

  syncSessionSummaries(cwd, sessionRecords)

  return { complete: !partialFailure, didSync: true }
}

type RefreshOptions = { emitRefreshEvent?: boolean | undefined; force?: boolean | undefined }

export function makeShellIndexScheduler() {
  return Effect.gen(function* () {
    const synced = new Set<string>()
    const running = yield* FiberMap.make<string, boolean, never>()
    const run = yield* FiberMap.runtime(running)<never>()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        closed = true
        yield* FiberMap.awaitEmpty(running)
      }),
    )

    const start = (
      cwd: string,
      options: { emitRefreshEvent?: boolean | undefined; warningLabel: string },
    ) =>
      run(
        cwd,
        Effect.tryPromise({ try: () => syncShellIndex(cwd), catch: (error) => error }).pipe(
          Effect.map((result) => {
            if (result.complete) synced.add(cwd)
            if (result.didSync && (options.emitRefreshEvent ?? true))
              emitDesktopEvent({ type: 'shell-state-refresh' })
            return result.complete
          }),
          Effect.catch((error) =>
            Effect.sync(() => {
              console.warn(options.warningLabel, error)
              return false
            }),
          ),
          // DB/import mutations already started must settle before backend shutdown.
          Effect.uninterruptible,
        ),
      )

    const refresh = Effect.fn('ShellIndex.refresh')(function* (
      cwd: string,
      options: RefreshOptions = {},
    ) {
      if (closed) return false
      const pending = FiberMap.getUnsafe(running, cwd)
      if (Option.isSome(pending) && !options.force) return yield* Fiber.join(pending.value)
      if (Option.isSome(pending)) yield* Fiber.join(pending.value)
      // A forced import must see files created after the startup snapshot.
      // Concurrent forced callers share the one subsequent pass.
      if (closed) return false
      return yield* Fiber.join(
        Option.getOrElse(FiberMap.getUnsafe(running, cwd), () =>
          start(cwd, {
            emitRefreshEvent: options.emitRefreshEvent,
            warningLabel: 'Failed to refresh shell index.',
          }),
        ),
      )
    })

    return {
      schedule: (cwd: string) => {
        if (closed || synced.has(cwd) || FiberMap.hasUnsafe(running, cwd)) return
        start(cwd, { warningLabel: 'Failed to sync shell index.' })
      },
      refresh,
    }
  })
}

const shellIndexScope = Scope.makeUnsafe()
const scheduler = Effect.runSync(Scope.provide(makeShellIndexScheduler(), shellIndexScope))

export const scheduleShellIndexSync = scheduler.schedule

export function refreshShellIndex(cwd: string, options: RefreshOptions = {}) {
  return Effect.runPromise(scheduler.refresh(cwd, options))
}

export function disposeShellIndexScheduler() {
  return Effect.runPromise(Scope.close(shellIndexScope, Exit.void))
}
