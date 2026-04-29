import type { DesktopEvent } from "../../shared/desktop-contracts.ts";

let eventSink: ((event: DesktopEvent) => void) | null = null;

export function setRuntimeHostEventSink(sink: (event: DesktopEvent) => void) {
  eventSink = sink;
}

export function emitDesktopEvent(event: DesktopEvent) {
  eventSink?.(event);
}
