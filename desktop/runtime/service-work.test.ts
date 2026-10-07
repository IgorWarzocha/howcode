import { describe, expect, it } from 'vitest'
import { createServiceWork } from './service-work.ts'

describe('service work lifetime', () => {
  it('rejects late admission and drains work reserved before shutdown', async () => {
    const work = createServiceWork('Test')
    let release: (value: string) => void = () => undefined
    const blocked = new Promise<string>((resolve) => {
      release = resolve
    })
    const task = work.run(() => blocked)
    const drain = work.stop()
    expect(work.stop()).toBe(drain)
    await expect(work.run(async () => 'late')).rejects.toThrow('shutting down')
    let finished = false
    void drain.then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    release('completed')
    await expect(task).resolves.toBe('completed')
    await drain
    expect(finished).toBe(true)
  })

  it('preserves failure for the caller without stranding cleanup', async () => {
    const work = createServiceWork('Test')
    const error = new Error('operation failed')
    const task = work.run(async () => {
      throw error
    })
    const drain = work.stop()
    await expect(task).rejects.toBe(error)
    await drain
  })
})
