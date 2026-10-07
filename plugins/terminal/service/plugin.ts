import type { TerminalRpcResponse } from '../../../shared/terminal-rpc.ts'
import { createTerminalHostPlugin } from './host-plugin.ts'
import { closeAllTerminals, disposeTerminalRuntime } from './runtime.ts'

export function createTerminalServicePlugin(send: (message: TerminalRpcResponse) => void) {
  const rpc = createTerminalHostPlugin(send)
  let disposal: Promise<void> | undefined
  return {
    write: rpc.write,
    dispose() {
      disposal ??= (async () => {
        const failures: unknown[] = []
        const captureFailure = (error: unknown) => {
          failures.push(error)
        }
        // RPC drain precedes sessions. Scoped runtime disposal is always last.
        await rpc.dispose().catch(captureFailure)
        await closeAllTerminals().catch(captureFailure)
        await disposeTerminalRuntime().catch(captureFailure)
        if (failures.length > 0)
          throw new AggregateError(failures, 'Failed to dispose terminal plugin.')
      })()
      return disposal
    },
  }
}
