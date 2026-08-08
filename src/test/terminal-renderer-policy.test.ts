import type { TerminalEvent } from '@howcode/desktop'
import { describe, expect, it } from 'vitest'
import {
  bufferPendingTerminalEvent,
  type PendingTerminalEvents,
  takePendingTerminalEvents,
} from '../app/native/terminal/terminal-pending-events'
import {
  getTerminalCleanupAction,
  getTerminalPersistedSessionPath,
} from '../app/native/terminal/terminal-session-policy'
import { MAX_PENDING_TERMINAL_EVENTS } from '../app/native/terminal/terminalViewportUtils'

function outputEvent(sessionId: string, index: number): TerminalEvent {
  return {
    type: 'output',
    sessionId,
    createdAt: `event-${index}`,
    data: String(index),
  }
}

describe('terminal pending event buffering', () => {
  it('caps events per session without unrelated traffic evicting the opening session', () => {
    const pendingEvents: PendingTerminalEvents = new Map()
    bufferPendingTerminalEvent(pendingEvents, outputEvent('target', 1))
    for (let index = 0; index < MAX_PENDING_TERMINAL_EVENTS + 20; index += 1) {
      bufferPendingTerminalEvent(pendingEvents, outputEvent('noise', index))
    }
    bufferPendingTerminalEvent(pendingEvents, outputEvent('target', 2))

    expect(
      takePendingTerminalEvents(pendingEvents, 'target').map((event) => event.sessionId),
    ).toEqual(['target', 'target'])
    expect(pendingEvents.size).toBe(0)
  })

  it('keeps only the newest events for each session', () => {
    const pendingEvents: PendingTerminalEvents = new Map()
    for (let index = 0; index < MAX_PENDING_TERMINAL_EVENTS + 2; index += 1) {
      bufferPendingTerminalEvent(pendingEvents, outputEvent('target', index))
    }

    const events = takePendingTerminalEvents(pendingEvents, 'target')
    expect(events).toHaveLength(MAX_PENDING_TERMINAL_EVENTS)
    expect(events[0]).toMatchObject({ type: 'output', data: '2' })
  })
})

describe('terminal renderer policies', () => {
  it('preserves a shell with content and deletes an empty shell', () => {
    expect(
      getTerminalCleanupAction({
        policy: { kind: 'shell' },
        terminalHistory: '$ pwd\r\n/home/igorw',
        terminalPersistedSessionPath: null,
      }),
    ).toEqual({ kind: 'preserve' })
    expect(
      getTerminalCleanupAction({
        policy: { kind: 'shell' },
        terminalHistory: '\u001b[2J\u001b[H',
        terminalPersistedSessionPath: null,
      }),
    ).toEqual({ kind: 'close', deleteHistory: true })
  })

  it('waits for persisted Pi sessions to become idle and delays local sessions', () => {
    const policy = {
      kind: 'pi-session' as const,
      closeWhenSessionFileIdleMs: 300_000,
      keepAliveMsOnUnmount: 300_000,
      maxKeepAliveMsOnUnmount: 43_200_000,
    }
    expect(
      getTerminalCleanupAction({
        policy,
        terminalHistory: '',
        terminalPersistedSessionPath: '/sessions/thread.jsonl',
      }),
    ).toEqual({
      kind: 'close-after-session-file-idle',
      pollMs: 300_000,
      maxKeepAliveMs: 43_200_000,
    })
    expect(
      getTerminalCleanupAction({
        policy,
        terminalHistory: '',
        terminalPersistedSessionPath: null,
      }),
    ).toEqual({ kind: 'close-after-delay', delayMs: 300_000 })
  })

  it('keeps a persisted fallback when a Pi takeover began from a local draft', () => {
    expect(
      getTerminalPersistedSessionPath({
        launchMode: 'pi-session',
        sessionPath: '/sessions/thread.jsonl',
        terminalSessionPath: 'local://project/draft',
      }),
    ).toBe('/sessions/thread.jsonl')
  })
})
