import { describe, expect, test } from 'vitest'
import { getRuntimeHostRequestSessionPath, shouldUseThreadRuntimeHost } from './request-routing.ts'

describe('runtime host request routing', () => {
  test('keeps project-level composer requests on the service host', () => {
    expect(shouldUseThreadRuntimeHost('startNewThread', { request: { projectId: '/repo' } })).toBe(
      false,
    )
    expect(
      shouldUseThreadRuntimeHost('getComposerSlashCommands', { request: { projectId: '/repo' } }),
    ).toBe(false)
  })

  test('routes persisted session composer mutations to a thread host', () => {
    const payload = { request: { sessionPath: '/repo/.pi/session.json' } }

    expect(getRuntimeHostRequestSessionPath('openThreadRuntime', payload)).toBe(
      '/repo/.pi/session.json',
    )
    expect(shouldUseThreadRuntimeHost('openThreadRuntime', payload)).toBe(true)
    expect(shouldUseThreadRuntimeHost('stopComposerRun', payload)).toBe(true)
    expect(
      shouldUseThreadRuntimeHost('navigateSessionTree', {
        ...payload,
        targetEntryId: 'entry-1',
        summarize: false,
      }),
    ).toBe(true)
  })

  test('keeps snapshot reads on the service host even with a session path', () => {
    expect(
      shouldUseThreadRuntimeHost('loadThreadSnapshot', {
        sessionPath: '/repo/.pi/session.json',
      }),
    ).toBe(false)
    expect(
      shouldUseThreadRuntimeHost('loadSessionTreeList', {
        sessionPath: '/repo/.pi/session.json',
      }),
    ).toBe(false)
  })
})
