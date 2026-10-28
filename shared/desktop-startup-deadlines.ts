import { desktopShutdownTimeouts } from './desktop-shutdown-deadlines'

// A fresh profile snapshots the installed component dependency graphs before readiness.
// Cold Cloud filesystems exceed the former 15-second service deadline on that work.
const serviceReadyMs = 120_000

export const desktopStartupTimeouts = {
  serviceReadyMs,
  // Let a failed service start finish cleanup and report its error through the bridge.
  bridgeReadyMs: serviceReadyMs + desktopShutdownTimeouts.serverCleanupMs + 1_000,
} as const
