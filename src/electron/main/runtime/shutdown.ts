import * as Effect from 'effect/Effect'
import { app } from 'electron'
import type { DesktopServiceRuntime } from '../../../../shared/desktop-service-contracts'
import { makeShutdownCoordinator } from '../../../../shared/effect-shutdown'

function settledTask<A>(evaluate: () => A) {
  return Effect.exit(Effect.promise(async () => await evaluate())).pipe(Effect.asVoid)
}

export async function registerDesktopRuntimeShutdown(
  runtime: DesktopServiceRuntime,
  additionalCleanup: () => unknown,
) {
  let cleanupStarted = false
  let cleanupFinished = false
  const coordinator = await Effect.runPromise(
    makeShutdownCoordinator(
      Effect.all(
        [
          settledTask(() => runtime.terminalManager.closeAllTerminals()),
          settledTask(() => runtime.piThreads.disposeDesktopRuntime?.()),
          settledTask(additionalCleanup),
        ],
        { concurrency: 'unbounded', discard: true },
      ),
      { label: 'Desktop runtime', timeout: '2 seconds' },
    ),
  )

  app.on('before-quit', (event) => {
    if (cleanupFinished) {
      return
    }

    event.preventDefault()

    if (cleanupStarted) {
      return
    }

    cleanupStarted = true
    void Effect.runPromise(coordinator.shutdown).finally(() => {
      cleanupFinished = true
      app.quit()
    })
  })
}
