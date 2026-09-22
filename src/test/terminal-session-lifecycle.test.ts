import { describe, expect, it } from 'vitest'
import {
  createTerminalSessionOwnership,
  getTerminalViewportIdentity,
} from '../app/native/terminal/terminal-session-ownership'
import {
  getTerminalCleanupAction,
  type TerminalCleanupAction,
  type TerminalSessionPolicy,
} from '../app/native/terminal/terminal-session-policy'

const shellPolicy = { kind: 'shell' } satisfies TerminalSessionPolicy

function shellCleanup(history: string) {
  return getTerminalCleanupAction({
    policy: shellPolicy,
    terminalHistory: history,
    terminalPersistedSessionPath: null,
  })
}

const terminalIdentity = getTerminalViewportIdentity({
  launchMode: 'shell',
  projectId: '/project',
  sessionPath: null,
})

describe('terminal session lifecycle', () => {
  it('releases a terminal that finishes opening after its viewport leaves', () => {
    const ownership = createTerminalSessionOwnership()
    const viewport = ownership.begin(terminalIdentity)

    ownership.leave(viewport, shellCleanup(''))
    expect(
      ownership.opened(viewport, {
        sessionId: 'late-session',
        action: shellCleanup(''),
      }),
    ).toBe(false)
    expect(ownership.takeReadyReleases(terminalIdentity)).toEqual([
      {
        sessionId: 'late-session',
        action: { kind: 'close', deleteHistory: true },
      },
    ])
  })

  it('does not release a late session already adopted by a replacement viewport', () => {
    const ownership = createTerminalSessionOwnership()
    const oldViewport = ownership.begin(terminalIdentity)
    ownership.leave(oldViewport, shellCleanup(''))
    const replacementViewport = ownership.begin(terminalIdentity)

    expect(
      ownership.opened(replacementViewport, {
        sessionId: 'shared-session',
        action: shellCleanup(''),
      }),
    ).toBe(true)
    expect(
      ownership.opened(oldViewport, {
        sessionId: 'shared-session',
        action: shellCleanup(''),
      }),
    ).toBe(false)

    ownership.leave(replacementViewport, shellCleanup(''))
    expect(ownership.takeReadyReleases(terminalIdentity)).toEqual([
      {
        sessionId: 'shared-session',
        action: { kind: 'close', deleteHistory: true },
      },
    ])
  })

  it('defers late release while a replacement viewport is still opening', () => {
    const ownership = createTerminalSessionOwnership()
    const oldViewport = ownership.begin(terminalIdentity)
    ownership.leave(oldViewport, shellCleanup(''))
    const replacementViewport = ownership.begin(terminalIdentity)

    expect(
      ownership.opened(oldViewport, {
        sessionId: 'shared-session',
        action: shellCleanup(''),
      }),
    ).toBe(false)
    expect(ownership.takeReadyReleases(terminalIdentity)).toEqual([])
    expect(
      ownership.opened(replacementViewport, {
        sessionId: 'shared-session',
        action: shellCleanup(''),
      }),
    ).toBe(true)
    expect(ownership.takeReadyReleases(terminalIdentity)).toEqual([])
  })

  it('lets an effect replacement reserve an adopted session before release', () => {
    const ownership = createTerminalSessionOwnership()
    const oldViewport = ownership.begin(terminalIdentity)
    ownership.opened(oldViewport, {
      sessionId: 'shared-session',
      action: shellCleanup(''),
    })
    ownership.leave(oldViewport, shellCleanup(''))

    const replacementViewport = ownership.begin(terminalIdentity)
    expect(ownership.takeReadyReleases(terminalIdentity)).toEqual([])
    expect(
      ownership.opened(replacementViewport, {
        sessionId: 'shared-session',
        action: shellCleanup(''),
      }),
    ).toBe(true)
    expect(ownership.takeReadyReleases(terminalIdentity)).toEqual([])
  })

  it('releases a deferred late session when its replacement open fails', () => {
    const ownership = createTerminalSessionOwnership()
    const oldViewport = ownership.begin(terminalIdentity)
    ownership.leave(oldViewport, shellCleanup(''))
    const replacementViewport = ownership.begin(terminalIdentity)
    ownership.opened(oldViewport, {
      sessionId: 'orphaned-session',
      action: shellCleanup(''),
    })

    ownership.failed(replacementViewport)
    expect(ownership.takeReadyReleases(terminalIdentity)).toEqual([
      {
        sessionId: 'orphaned-session',
        action: { kind: 'close', deleteHistory: true },
      },
    ])
  })
})

describe('terminal session retention policy', () => {
  it('preserves shell sessions with visible history and deletes empty shell sessions', () => {
    expect(shellCleanup('\u001b[32mvisible output\u001b[0m')).toEqual({ kind: 'preserve' })
    expect(shellCleanup('\u001b[2J\u001b[H')).toEqual({ kind: 'close', deleteHistory: true })
  })

  it('retains Pi sessions with their configured unmount policy', () => {
    const delayedPolicy = {
      kind: 'pi-session',
      closeWhenSessionFileIdleMs: 250,
      keepAliveMsOnUnmount: 5_000,
      maxKeepAliveMsOnUnmount: 60_000,
    } satisfies TerminalSessionPolicy
    const immediatePolicy = {
      kind: 'pi-session',
      closeWhenSessionFileIdleMs: 0,
      keepAliveMsOnUnmount: 0,
      maxKeepAliveMsOnUnmount: 60_000,
    } satisfies TerminalSessionPolicy

    expect(
      getTerminalCleanupAction({
        policy: delayedPolicy,
        terminalHistory: '',
        terminalPersistedSessionPath: '/sessions/thread.jsonl',
      }),
    ).toEqual({
      kind: 'close-after-session-file-idle',
      pollMs: 250,
      maxKeepAliveMs: 60_000,
    } satisfies TerminalCleanupAction)
    expect(
      getTerminalCleanupAction({
        policy: immediatePolicy,
        terminalHistory: 'visible output',
        terminalPersistedSessionPath: null,
      }),
    ).toEqual({ kind: 'close', deleteHistory: false })
  })
})
