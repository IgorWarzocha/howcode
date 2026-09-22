const TERMINAL_EXIT_AFTER_SIGNAL_MS = 1_000
const NESTED_SHUTDOWN_GRACE_MS = 1_000

// The service must survive both terminal signal waits, then leave time for transcript,
// runtime, and database disposal. Each outer owner gets another full grace interval.
const desktopServiceCleanupMs = TERMINAL_EXIT_AFTER_SIGNAL_MS * 2 + NESTED_SHUTDOWN_GRACE_MS
const desktopServiceTerminationMs = desktopServiceCleanupMs + NESTED_SHUTDOWN_GRACE_MS
const electronCleanupMs = desktopServiceTerminationMs + NESTED_SHUTDOWN_GRACE_MS

export const desktopShutdownTimeouts = {
  terminalExitAfterSignalMs: TERMINAL_EXIT_AFTER_SIGNAL_MS,
  desktopServiceCleanupMs,
  desktopServiceTerminationMs,
  electronCleanupMs,
} as const
