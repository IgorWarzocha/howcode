import { expect, it, vi } from 'vitest'
import { createServerShutdown } from './shutdown'

it('disposes the service after HTTP close failure and coalesces repeated shutdown', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  let disposed = 0
  let closed = 0
  try {
    const shutdown = await createServerShutdown({
      closeServer: async () => {
        closed += 1
        throw new Error('Close failed')
      },
      disposeRuntime: async () => {
        disposed += 1
      },
    })
    await Promise.all([shutdown(), shutdown()])
    await shutdown()
    expect(closed).toBe(1)
    expect(disposed).toBe(1)
    expect(warn).toHaveBeenCalled()
  } finally {
    warn.mockRestore()
  }
})
