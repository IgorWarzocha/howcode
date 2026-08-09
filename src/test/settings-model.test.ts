import { describe, expect, it } from 'vitest'
import { appendPiSettingsWrite } from '../app/settings/settings/piSettingsWriteQueue'
import {
  normalizeCustomPiDirectoryDraft,
  normalizeOptionalSettingsPath,
} from '../app/settings/settings/useSettingsProjectController'

describe('settings domain model', () => {
  it('normalizes optional paths and expands a persisted Pi home prefix', () => {
    expect(normalizeOptionalSettingsPath('  /repo  ')).toBe('/repo')
    expect(normalizeOptionalSettingsPath('   ')).toBeNull()
    expect(normalizeCustomPiDirectoryDraft('~/.pi/agent', '/home/igorw/.pi/agent')).toBe(
      '/home/igorw/.pi/agent',
    )
    expect(normalizeCustomPiDirectoryDraft('~/other', '/home/igorw/.pi/agent')).toBe('~/other')
  })

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
