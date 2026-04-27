import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionFileStat,
  TerminalSessionSnapshot,
} from "../desktop/types";

export async function listDesktopTerminals() {
  return (await window.piDesktop?.listTerminals?.()) ?? [];
}

export async function openDesktopTerminal(request: TerminalOpenRequest) {
  if (!window.piDesktop?.openTerminal) {
    return null as TerminalSessionSnapshot | null;
  }

  return window.piDesktop.openTerminal(request);
}

export async function writeDesktopTerminal(sessionId: string, data: string) {
  await window.piDesktop?.writeTerminal?.(sessionId, data);
}

export async function resizeDesktopTerminal(request: TerminalResizeRequest) {
  await window.piDesktop?.resizeTerminal?.(request);
}

export async function closeDesktopTerminal(request: TerminalCloseRequest) {
  await window.piDesktop?.closeTerminal?.(request);
}

export async function statDesktopTerminalSessionFile(sessionId: string) {
  return ((await window.piDesktop?.statTerminalSessionFile?.(sessionId)) ??
    null) as TerminalSessionFileStat | null;
}

export async function getDesktopTerminalStatus(sessionId: string) {
  return (await window.piDesktop?.getTerminalStatus?.(sessionId)) ?? null;
}

export function subscribeDesktopTerminal(listener: (event: TerminalEvent) => void) {
  return window.piDesktop?.subscribeTerminal?.(listener) ?? (() => undefined);
}
