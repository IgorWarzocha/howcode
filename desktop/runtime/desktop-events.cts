import type { DesktopEvent } from "../../shared/desktop-contracts.ts";

const desktopListeners = new Set<(event: DesktopEvent) => void>();

export function emitDesktopEvent(event: DesktopEvent) {
  for (const listener of desktopListeners) {
    listener(event);
  }
}

export function subscribeDesktopEvents(listener: (event: DesktopEvent) => void) {
  desktopListeners.add(listener);

  return () => {
    desktopListeners.delete(listener);
  };
}
