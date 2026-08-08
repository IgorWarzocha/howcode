import { describe, expect, it } from 'vitest'
import {
  getLayoutThreadSelection,
  reconcileTakeoverTerminalIdentity,
  type TakeoverTerminalIdentity,
} from '../app/app-shell/app-shell-layout-model'
import { createInitialWorkspaceState } from '../app/state/workspace'

function identity(
  key: string,
  sessionPath: string | null,
  overrides: Partial<TakeoverTerminalIdentity> = {},
): TakeoverTerminalIdentity {
  return {
    key,
    projectId: 'project',
    sessionPath,
    threadId: null,
    ...overrides,
  }
}

describe('app shell layout model', () => {
  it('exposes thread selection only for thread-owning views', () => {
    const base = {
      ...createInitialWorkspaceState([]),
      selectedSessionPath: '/sessions/thread.jsonl',
      selectedThreadId: 'thread',
    }

    expect(getLayoutThreadSelection({ ...base, activeView: 'project' })).toEqual({
      sessionPath: '/sessions/thread.jsonl',
      threadId: 'thread',
    })
    expect(getLayoutThreadSelection({ ...base, activeView: 'settings' })).toEqual({
      sessionPath: null,
      threadId: null,
    })
  })

  it('keeps the terminal mounted when a local project draft becomes persisted', () => {
    const current = identity('project:local-thread', 'local://project/draft')
    const next = identity('project:persisted-thread', '/sessions/thread.jsonl', {
      threadId: 'persisted-thread',
    })

    expect(
      reconcileTakeoverTerminalIdentity({
        activeView: 'project',
        current,
        next,
        takeoverPresent: true,
        takeoverVisible: true,
      }),
    ).toEqual({ ...next, key: current.key })
  })

  it('remounts for a real thread switch and clears after animated exit', () => {
    const current = identity('project:first', '/sessions/first.jsonl', { threadId: 'first' })
    const next = identity('project:second', '/sessions/second.jsonl', { threadId: 'second' })
    expect(
      reconcileTakeoverTerminalIdentity({
        activeView: 'thread',
        current,
        next,
        takeoverPresent: true,
        takeoverVisible: true,
      }),
    ).toEqual(next)
    expect(
      reconcileTakeoverTerminalIdentity({
        activeView: 'thread',
        current: next,
        next,
        takeoverPresent: false,
        takeoverVisible: false,
      }),
    ).toBeNull()
  })
})
