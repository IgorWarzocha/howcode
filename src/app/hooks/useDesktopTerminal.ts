import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionSnapshot,
} from "../desktop/types";

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

export function subscribeDesktopTerminal(listener: (event: TerminalEvent) => void) {
  return window.piDesktop?.subscribeTerminal?.(listener) ?? (() => undefined);
}
