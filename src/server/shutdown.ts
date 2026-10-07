import * as Effect from 'effect/Effect'
import { desktopShutdownTimeouts } from '../../shared/desktop-shutdown-deadlines'
import { makeShutdownCoordinator } from '../../shared/effect-shutdown'

export async function createServerShutdown(input: {
  closeServer: () => Promise<void>
  disposeRuntime: () => Promise<void>
}) {
  const coordinator = await Effect.runPromise(
    makeShutdownCoordinator(
      Effect.tryPromise({ try: input.closeServer, catch: (error) => error }).pipe(
        Effect.ensuring(Effect.promise(input.disposeRuntime)),
      ),
      { label: 'Browser server', timeout: desktopShutdownTimeouts.serverCleanupMs },
    ),
  )
  return () => Effect.runPromise(coordinator.shutdown)
}
