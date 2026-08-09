import { describe, expect, it } from 'vitest'
import { appendPiSettingsWrite } from '../app/settings/settings/piSettingsWriteQueue'

describe('Pi settings write queue', () => {
  it('serializes Pi settings writes and keeps the queue moving after failures', async () => {
    const events: string[] = []
    let releaseFirst!: () => void
    let markStarted!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const firstStarted = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const first = appendPiSettingsWrite(Promise.resolve(), async () => {
      events.push('theme:start')
      markStarted()
      await firstGate
      events.push('theme:end')
    })
    const second = appendPiSettingsWrite(first, async () => {
      events.push('transport')
    })

    await firstStarted
    expect(events).toEqual(['theme:start'])
    releaseFirst()
    await second
    expect(events).toEqual(['theme:start', 'theme:end', 'transport'])

    const recovered = appendPiSettingsWrite(Promise.reject(new Error('write failed')), async () =>
      events.push('recovered'),
    )
    await recovered
    expect(events.at(-1)).toBe('recovered')
  })
})
