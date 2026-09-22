import { desktopShutdownTimeouts } from '../../shared/desktop-shutdown-deadlines.ts'
import type { TerminalSessionRecord } from './session-record.ts'

function signalTerminalProcess(
  processHandle: NonNullable<TerminalSessionRecord['process']>,
  signal?: string,
) {
  return new Promise<boolean>((resolve, reject) => {
    let settled = false
    let unsubscribe: () => void = () => undefined
    const timeout = setTimeout(
      () => settle(false),
      desktopShutdownTimeouts.terminalExitAfterSignalMs,
    )
    const settle = (exited: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      unsubscribe()
      resolve(exited)
    }

    unsubscribe = processHandle.onExit(() => settle(true))
    try {
      processHandle.kill(signal)
    } catch (error) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      unsubscribe()
      reject(error)
    }
  })
}

export async function stopTerminalProcess(
  processHandle: NonNullable<TerminalSessionRecord['process']>,
  force: boolean,
) {
  if (!force) {
    try {
      if (await signalTerminalProcess(processHandle)) return
    } catch {
      // Escalate once before releasing ownership.
    }
  }
  if (!(await signalTerminalProcess(processHandle, 'SIGKILL'))) {
    throw new Error('Terminal process did not exit after SIGKILL.')
  }
}
