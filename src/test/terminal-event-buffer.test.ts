import type { TerminalEvent } from '@howcode/desktop'
import { describe, expect, it } from 'vitest'
import {
  bufferPendingTerminalEvent,
  type PendingTerminalEvents,
  takePendingTerminalEvents,
} from '../app/native/terminal/terminal-pending-events'
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
