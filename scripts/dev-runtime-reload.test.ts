import { describe, expect, it, vi } from 'vitest'
import type { DevRuntimeActivity } from '../shared/dev-runtime'
import { createDevRuntimeReload } from './dev-runtime-reload'

const idle: DevRuntimeActivity = {
  tasks: 0,
  blockedTasks: 0,
  submissions: 0,
  terminals: 0,
  requests: 0,
}

function setup(inspect = async () => idle) {
  const restart = vi.fn(async (_revision: string) => undefined)
  const report = vi.fn()
  const reload = createDevRuntimeReload({ inspect, restart, report })
  reload.initialise('initial')
  return { reload, restart, report }
}

describe('dev runtime reload admission', () => {
  it.each(['tasks', 'submissions', 'terminals', 'requests'] as const)(
    'defers while %s is nonzero and coalesces builds until idle',
    async (field) => {
      let activity = { ...idle, [field]: 1 }
      const { reload, restart } = setup(async () => activity)
      reload.request('first')
      await reload.check()
      expect(restart).not.toHaveBeenCalled()
      expect(reload.gated).toBe(false)
      reload.request('latest')
      activity = idle
      await reload.check()
      await reload.check()
      expect(restart.mock.calls).toEqual([['latest']])
    },
  )

  it('drains admitted requests, then excludes arrivals during inspection and restart', async () => {
    const inspection = Promise.withResolvers<DevRuntimeActivity>()
    const replacement = Promise.withResolvers<void>()
    const restart = vi.fn(() => replacement.promise)
    const inspect = vi.fn(() => inspection.promise)
    const reload = createDevRuntimeReload({ inspect, restart, report: () => undefined })
    const finish = reload.admit()
    expect(finish).not.toBeNull()
    reload.request('build')
    await reload.check()
    expect(inspect).not.toHaveBeenCalled()
    finish?.()
    finish?.()
    const handoff = reload.check()
    expect(reload.admit()).toBeNull()
    await reload.check()
    expect(inspect).toHaveBeenCalledTimes(1)
    inspection.resolve(idle)
    await vi.waitFor(() => expect(restart).toHaveBeenCalledTimes(1))
    expect(reload.admit()).toBeNull()
    replacement.resolve()
    await handoff
    expect(reload.admit()).not.toBeNull()
  })

  it('fails closed on inspection errors without interrupting the old runtime', async () => {
    const { reload, restart, report } = setup(async () => {
      throw new Error('inspection unavailable')
    })
    reload.request('build')
    await reload.check()
    await reload.check()
    expect(restart).not.toHaveBeenCalled()
    expect(reload.gated).toBe(false)
    expect(report.mock.calls).toEqual([['Dev reload failed: inspection unavailable']])
  })

  it('does not loop failed startups but permits recovery on a new build', async () => {
    const { reload, restart } = setup()
    restart.mockRejectedValueOnce(new Error('startup failed'))
    reload.request('broken')
    await reload.check()
    await reload.check()
    expect(restart).toHaveBeenCalledTimes(1)
    reload.request('fixed')
    await reload.check()
    expect(restart.mock.calls).toEqual([['broken'], ['fixed']])
  })

  it('never restarts after shutdown wins an in-flight inspection', async () => {
    const inspection = Promise.withResolvers<DevRuntimeActivity>()
    const { reload, restart } = setup(() => inspection.promise)
    reload.request('build')
    const checking = reload.check()
    reload.stop()
    inspection.resolve(idle)
    await checking
    expect(restart).not.toHaveBeenCalled()
    expect(reload.admit()).toBeNull()
  })
})
