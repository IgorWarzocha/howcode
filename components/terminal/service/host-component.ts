import type { TerminalRpcRequest, TerminalRpcResponse } from '../../../shared/terminal-rpc.ts'
import type { ToolkitComponentId } from '../../../shared/toolkit-components.ts'
import { createTerminalRpcServer } from './rpc-server.ts'
import * as terminalRuntime from './runtime.ts'

/** Demand owns RPC startup. The existing scoped Effect runtime owns terminals. */
export function createTerminalHostComponent(send: (message: TerminalRpcResponse) => void) {
  let serverPromise: ReturnType<typeof createTerminalRpcServer> | undefined
  let stopping = false
  return {
    id: 'terminal' satisfies ToolkitComponentId,
    async write(message: TerminalRpcRequest) {
      if (stopping) throw new Error('Desktop terminal service is shutting down.')
      serverPromise ??= terminalRuntime
        .getTerminalEffectService()
        .then((service) => createTerminalRpcServer(service, send))
      const server = await serverPromise
      if (stopping) throw new Error('Desktop terminal service is shutting down.')
      await server.write(message)
    },
    async dispose() {
      stopping = true
      if (serverPromise) {
        const server = await serverPromise
        await server.dispose()
      }
    },
  }
}
