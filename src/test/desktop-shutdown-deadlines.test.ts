import { expect, it } from 'vitest'
import { desktopShutdownTimeouts } from '../../shared/desktop-shutdown-deadlines'

it('keeps every desktop shutdown owner alive beyond its nested cleanup budget', () => {
  expect(desktopShutdownTimeouts.desktopServiceCleanupMs).toBeGreaterThan(
    desktopShutdownTimeouts.terminalExitAfterSignalMs * 2,
  )
  expect(desktopShutdownTimeouts.desktopServiceTerminationMs).toBeGreaterThan(
    desktopShutdownTimeouts.desktopServiceCleanupMs,
  )
  expect(desktopShutdownTimeouts.electronCleanupMs).toBeGreaterThan(
    desktopShutdownTimeouts.desktopServiceTerminationMs,
  )
})
