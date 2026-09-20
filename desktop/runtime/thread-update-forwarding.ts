import * as Effect from 'effect/Effect'
import * as FiberSet from 'effect/FiberSet'
import * as RcMap from 'effect/RcMap'
import * as Semaphore from 'effect/Semaphore'
import type { DesktopEvent } from '../../shared/desktop-contracts.ts'
import { markInternalThreadUpdate, rememberLiveThread } from './live-thread-store.ts'

type ThreadUpdate = Extract<DesktopEvent, { type: 'thread-update' }>

export function makeThreadUpdateForwarder(persist: (event: ThreadUpdate) => Promise<void>) {
  return Effect.gen(function* () {
    const locks = yield* RcMap.make({ lookup: (_sessionPath: string) => Semaphore.make(1) })
    const tasks = yield* FiberSet.make<void, never>()
    const run = yield* FiberSet.runtime(tasks)<never>()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        closed = true
        yield* FiberSet.awaitEmpty(tasks)
      }),
    )

    return (event: ThreadUpdate, listener: (event: DesktopEvent) => void) => {
      if (closed) return
      run(
        Effect.scoped(
          Effect.gen(function* () {
            const lock = yield* RcMap.get(locks, event.sessionPath)
            yield* lock.withPermit(
              Effect.gen(function* () {
                markInternalThreadUpdate(event.sessionPath)
                rememberLiveThread(event.sessionPath, event.thread)
                yield* Effect.tryPromise({
                  try: () => persist(event),
                  catch: (error) => error,
                }).pipe(
                  Effect.catch((error) =>
                    Effect.sync(() =>
                      console.warn(
                        `Failed to persist Pi runtime host thread update: ${event.sessionPath}`,
                        error,
                      ),
                    ),
                  ),
                )
                listener({ ...event })
              }),
            )
          }),
        ).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() =>
              console.warn(
                `Failed to forward Pi runtime host thread update: ${event.sessionPath}`,
                cause,
              ),
            ),
          ),
          // Accepted updates drain in order, including persistence, before scope shutdown.
          Effect.uninterruptible,
        ),
      )
    }
  })
}
