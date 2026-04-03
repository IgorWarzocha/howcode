import type { TerminalEvent } from "../../shared/terminal-contracts";
import type { TerminalSessionRecord } from "./session-record";

const terminalListeners = new Set<(event: TerminalEvent) => void>();
const terminalSessions = new Map<string, TerminalSessionRecord>();

export function emitTerminalEvent(event: TerminalEvent) {
  for (const listener of terminalListeners) {
    listener(event);
  }
}

export function getTerminalSession(sessionId: string) {
  return terminalSessions.get(sessionId) ?? null;
}

export function setTerminalSession(sessionId: string, record: TerminalSessionRecord) {
  terminalSessions.set(sessionId, record);
}

export function deleteTerminalSession(sessionId: string) {
  terminalSessions.delete(sessionId);
}

export function subscribeTerminalEvents(listener: (event: TerminalEvent) => void) {
  terminalListeners.add(listener);
  return () => {
    terminalListeners.delete(listener);
  };
}
