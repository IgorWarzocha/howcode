import { type DevRuntimeActivity, isDevRuntimeIdle } from '../shared/dev-runtime'

/** Admission and idle inspection share one gate: no new request can race the handoff. */
export function createDevRuntimeReload(input: {
  inspect: () => Promise<DevRuntimeActivity>
  restart: (revision: string) => Promise<void>
  report: (message: string) => void
}) {
  let requests = 0
  let gated = false
  let stopped = false
  let handoff: PromiseWithResolvers<void> | null = null
  let applied: string | null = null
  let pending: string | null = null
  let lastReport = ''
  const report = (message: string) => {
    if (message !== lastReport) input.report(message)
    lastReport = message
  }
  return {
    initialise(revision: string) {
      applied = revision
    },
    request(revision: string) {
      pending = revision
    },
    stop() {
      stopped = true
      gated = true
      handoff?.resolve()
    },
    admit() {
      if (gated || stopped) return null
      requests += 1
      let done = false
      return () => {
        if (done) return
        done = true
        requests -= 1
      }
    },
    get gated() {
      return gated
    },
    get handoff() {
      return handoff?.promise
    },
    async check() {
      if (stopped || handoff || requests > 0 || !pending || pending === applied) return
      const currentHandoff = Promise.withResolvers<void>()
      handoff = currentHandoff
      gated = true
      try {
        const activity = await input.inspect()
        if (stopped) return
        if (!isDevRuntimeIdle(activity)) {
          report(
            `Reload queued: ${activity.tasks} task(s), ${activity.submissions} submission(s), ${activity.requests} request(s), busy components: ${activity.busyComponents.join(', ') || 'none'}; ${activity.blockedTasks} blocked task(s). Waiting for idle.`,
          )
          return
        }
        const revision = pending
        // A failed startup is not retried blindly; the next successful build can recover it.
        applied = revision
        report('Reloading dev backend…')
        await input.restart(revision)
        report('Dev backend reloaded; web address and login unchanged.')
      } catch (error) {
        report(`Dev reload failed: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        gated = stopped
        handoff = null
        currentHandoff.resolve()
      }
    },
  }
}
