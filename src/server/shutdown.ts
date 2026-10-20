import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { desktopShutdownTimeouts } from '../../shared/desktop-shutdown-deadlines'
import { makeShutdownCoordinator } from '../../shared/effect-shutdown'

export async function createServerShutdown(input: {
  closeServer: () => Promise<void>
  disposeRuntime: () => Promise<void>
}) {
  let cleaned = false
  let failure: unknown
  const coordinator = await Effect.runPromise(
    makeShutdownCoordinator(
      Effect.tryPromise({ try: input.closeServer, catch: (error) => error }).pipe(
        Effect.ensuring(Effect.promise(input.disposeRuntime)),
        Effect.tap(() =>
          Effect.sync(() => {
            cleaned = true
          }),
        ),
        Effect.onExit((exit) =>
          Exit.isFailure(exit)
            ? Effect.sync(() => {
                failure = Cause.squash(exit.cause)
              })
            : Effect.void,
        ),
      ),
      { label: 'Browser server', timeout: desktopShutdownTimeouts.serverCleanupMs },
    ),
  )
  return async () => {
    await Effect.runPromise(coordinator.shutdown)
    if (!cleaned) throw failure ?? new Error('Browser server shutdown did not complete.')
  }
}
