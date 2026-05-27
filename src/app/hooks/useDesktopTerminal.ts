import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
} from '../desktop/types'
import {
  closeDesktopTerminalQuery,
  getDesktopTerminalStatusQuery,
  listDesktopTerminalsQuery,
  openDesktopTerminalQuery,
  resizeDesktopTerminalQuery,
  statDesktopTerminalSessionFileQuery,
  subscribeDesktopTerminalQuery,
  writeDesktopTerminalQuery,
} from '../query/desktop-query'

export async function listDesktopTerminals() {
  return listDesktopTerminalsQuery()
}

export async function openDesktopTerminal(request: TerminalOpenRequest) {
  return openDesktopTerminalQuery(request)
}

export async function writeDesktopTerminal(sessionId: string, data: string) {
  await writeDesktopTerminalQuery(sessionId, data)
}

export async function resizeDesktopTerminal(request: TerminalResizeRequest) {
  await resizeDesktopTerminalQuery(request)
}

export async function closeDesktopTerminal(request: TerminalCloseRequest) {
  await closeDesktopTerminalQuery(request)
}

export async function statDesktopTerminalSessionFile(sessionId: string) {
  return statDesktopTerminalSessionFileQuery(sessionId)
}

export async function getDesktopTerminalStatus(sessionId: string) {
  return getDesktopTerminalStatusQuery(sessionId)
}

export function subscribeDesktopTerminal(listener: (event: TerminalEvent) => void) {
  return subscribeDesktopTerminalQuery(listener)
}
