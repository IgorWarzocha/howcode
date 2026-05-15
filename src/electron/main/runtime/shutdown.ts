import { app } from 'electron'
import type { DesktopRuntimeModules } from './desktop-runtime-contracts'

const SHUTDOWN_TIMEOUT_MS = 2_000

function withShutdownTimeout(task: Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)
    timer.unref?.()
  })

  return Promise.race([task, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

export function registerDesktopRuntimeShutdown(runtime: DesktopRuntimeModules) {
  let cleanupStarted = false
  let cleanupFinished = false

  async function cleanupRuntime() {
    await withShutdownTimeout(
      Promise.allSettled([
        runtime.terminalManager.closeAllTerminals?.(),
        runtime.piThreads.disposeDesktopRuntime?.(),
      ]),
    )
  }

  app.on('before-quit', (event) => {
    if (cleanupFinished) {
      return
    }

    event.preventDefault()

    if (cleanupStarted) {
      return
    }

    cleanupStarted = true
    void cleanupRuntime()
      .catch((error) => {
        console.warn('Failed to cleanly shut down desktop runtime.', error)
      })
      .finally(() => {
        cleanupFinished = true
        app.quit()
      })
  })
}
