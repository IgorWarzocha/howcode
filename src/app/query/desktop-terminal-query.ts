import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionFileStat,
  TerminalSessionSnapshot,
} from '../desktop/types'

export async function listDesktopTerminalsQuery(): Promise<TerminalSessionSnapshot[]> {
  return (await window.piDesktop?.listTerminals?.()) ?? []
}

export async function openDesktopTerminalQuery(
  request: TerminalOpenRequest,
): Promise<TerminalSessionSnapshot | null> {
  return (await window.piDesktop?.openTerminal?.(request)) ?? null
}

export async function writeDesktopTerminalQuery(sessionId: string, data: string): Promise<void> {
  await window.piDesktop?.writeTerminal?.(sessionId, data)
}

export async function resizeDesktopTerminalQuery(request: TerminalResizeRequest): Promise<void> {
  await window.piDesktop?.resizeTerminal?.(request)
}

export async function closeDesktopTerminalQuery(request: TerminalCloseRequest): Promise<void> {
  await window.piDesktop?.closeTerminal?.(request)
}

export async function statDesktopTerminalSessionFileQuery(
  sessionId: string,
): Promise<TerminalSessionFileStat | null> {
  return (await window.piDesktop?.statTerminalSessionFile?.(sessionId)) ?? null
}

export async function getDesktopTerminalStatusQuery(sessionId: string) {
  return (await window.piDesktop?.getTerminalStatus?.(sessionId)) ?? null
}

export function subscribeDesktopTerminalQuery(listener: (event: TerminalEvent) => void) {
  return window.piDesktop?.subscribeTerminal?.(listener) ?? (() => undefined)
}
