import * as Deferred from 'effect/Deferred'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as Schedule from 'effect/Schedule'
import type { DesktopServiceError, DesktopServiceState, ServiceMessageHandler } from './types'

export function makeDesktopServiceRecovery<Process>(options: {
  readonly enabled: Deferred.Deferred<ServiceMessageHandler<Process>>
  readonly ensureStarted: (
    handler: ServiceMessageHandler<Process>,
  ) => Effect.Effect<Process, DesktopServiceError>
  readonly state: Ref.Ref<DesktopServiceState<Process>>
}) {
  return Effect.gen(function* () {
    const handleMessage = yield* Deferred.await(options.enabled)
    const waitClosed = Effect.gen(function* () {
      const current = (yield* Ref.get(options.state)).current
      if (current) yield* Deferred.await(current.closed)
    })
    // First startup is caller-owned. Only a ready generation enables supervision.
    yield* waitClosed
    yield* options.ensureStarted(handleMessage).pipe(
      Effect.catch(() => Effect.void),
      Effect.andThen(waitClosed),
      Effect.repeat(
        Schedule.exponential('2 seconds').pipe(
          Schedule.modifyDelay(({ duration }) =>
            Effect.succeed(Duration.min(duration, Duration.seconds(30))),
          ),
        ),
      ),
      Effect.delay('1 second'),
    )
  }).pipe(
    Effect.tapError((error) =>
      Effect.sync(() =>
        console.error('Desktop service recovery stopped after cleanup failed.', error),
      ),
    ),
  )
}
