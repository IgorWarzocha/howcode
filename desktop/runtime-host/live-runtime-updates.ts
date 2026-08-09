import * as Effect from 'effect/Effect'
import * as FiberMap from 'effect/FiberMap'
import * as FiberSet from 'effect/FiberSet'
import type * as Scope from 'effect/Scope'
import type { PiRuntime } from '../runtime/types.ts'

const LIVE_THREAD_UPDATE_THROTTLE_MS = 50
const PI_EXTENSION_UI_UPDATE_FRAME_MS = 16

type ScheduledUpdate = 'extension-ui' | 'thread'
type UpdateTask = () => unknown | PromiseLike<unknown>

export interface RuntimeUpdateScheduler {
  readonly isActive: () => boolean
  readonly close: () => void
  readonly cancelThread: () => void
  readonly deferCompaction: (task: UpdateTask) => void
  readonly deferThread: (task: UpdateTask) => void
  readonly run: (label: string, task: UpdateTask) => void
  readonly scheduleExtensionUi: (task: UpdateTask) => void
  readonly scheduleThread: (task: UpdateTask) => void
}

export interface LivePiRuntime extends PiRuntime {
  readonly updates: RuntimeUpdateScheduler
}

function runUpdateTask(task: UpdateTask, label: string) {
  return Effect.tryPromise({
    try: async () => await task(),
    catch: (error) => error,
  }).pipe(
    Effect.asVoid,
    Effect.catch((error) => Effect.sync(() => console.warn(`Failed to publish ${label}.`, error))),
  )
}

export const makeRuntimeUpdateScheduler: Effect.Effect<RuntimeUpdateScheduler, never, Scope.Scope> =
  Effect.gen(function* () {
    let active = true
    const scheduled = yield* FiberMap.make<ScheduledUpdate>()
    const runScheduled = yield* FiberMap.runtime(scheduled)<never>()
    const runPublication = yield* FiberSet.makeRuntime<never, void, never>()

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        active = false
      }),
    )

    const cancel = (key: ScheduledUpdate) => {
      if (!active) return
      runScheduled(key, Effect.void)
    }

    const publication = (task: UpdateTask, label: string) =>
      Effect.suspend(() => (active ? runUpdateTask(task, label) : Effect.void))

    const schedule = (
      key: ScheduledUpdate,
      delay: number,
      label: string,
      task: UpdateTask,
      onlyIfMissing: boolean,
    ) => {
      if (!active) return
      runScheduled(
        key,
        Effect.sleep(delay).pipe(
          Effect.andThen(
            Effect.sync(() => {
              if (active) runPublication(publication(task, label))
            }),
          ),
        ),
        { onlyIfMissing },
      )
    }

    return {
      isActive: () => active,
      close: () => {
        active = false
      },
      cancelThread: () => cancel('thread'),
      deferCompaction: (task) => {
        if (active)
          runPublication(
            Effect.sleep(0).pipe(Effect.andThen(publication(task, 'runtime compaction update'))),
          )
      },
      deferThread: (task) => schedule('thread', 0, 'live thread update', task, false),
      run: (label, task) => {
        if (active) runPublication(publication(task, label))
      },
      scheduleExtensionUi: (task) =>
        schedule(
          'extension-ui',
          PI_EXTENSION_UI_UPDATE_FRAME_MS,
          'extension UI update',
          task,
          true,
        ),
      scheduleThread: (task) =>
        schedule('thread', LIVE_THREAD_UPDATE_THROTTLE_MS, 'live thread update', task, true),
    }
  })
