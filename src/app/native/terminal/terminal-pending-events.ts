import type { TerminalEvent } from '@howcode/desktop'
import { MAX_PENDING_TERMINAL_EVENTS } from './terminalViewportUtils'

export type PendingTerminalEvents = Map<string, TerminalEvent[]>

export function bufferPendingTerminalEvent(
  pendingEvents: PendingTerminalEvents,
  event: TerminalEvent,
) {
  const sessionEvents = pendingEvents.get(event.sessionId) ?? []
  sessionEvents.push(event)
  if (sessionEvents.length > MAX_PENDING_TERMINAL_EVENTS) {
    sessionEvents.splice(0, sessionEvents.length - MAX_PENDING_TERMINAL_EVENTS)
  }
  pendingEvents.set(event.sessionId, sessionEvents)
}

export function takePendingTerminalEvents(pendingEvents: PendingTerminalEvents, sessionId: string) {
  const sessionEvents = pendingEvents.get(sessionId) ?? []
  pendingEvents.clear()
  return sessionEvents
}
